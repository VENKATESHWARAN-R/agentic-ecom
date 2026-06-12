# Voltti — Agentic E-commerce POC

Guidance for AI agents working in this repository.

## What this project is

A proof-of-concept electronics storefront ("Voltti", EUR pricing) where users shop two ways:

1. **Traditional UI** — browse categories, filter, compare, cart, mock checkout.
2. **Agentic chat** — a CopilotKit-powered assistant that searches the catalog, recommends and compares products, flags PC-part incompatibilities, suggests in-stock alternatives, steers the UI, and builds the cart / places orders **only with explicit human approval**.

Keep it POC-sized and simple. No databases, auth, real payments, or external commerce APIs.

## Stack

- Next.js (App Router) + React + TypeScript, plain CSS in `src/app/globals.css` (no Tailwind in app code)
- CopilotKit v2 APIs from **`@copilotkit/react-core/v2`** (client) and **`@copilotkit/runtime` + `@copilotkit/runtime/v2`** (server). The non-`/v2` react imports are the legacy v1 API — do not mix them in.
- Zod for tool parameter schemas
- In-memory catalog + deterministic domain services (no network calls in the domain layer)

## Map of the code

| Path | What it is |
|---|---|
| `src/lib/types.ts` | Domain types: `Product`, `Compat`, `CartLine`, `SearchFilters`, `Order`, `UserProfile`, `PersonaId`, `ReturnEligibility`, `OwnedPart`, etc. Start here. |
| `src/lib/catalog.ts` | 61 realistic products with specs, stock, deals, and PC compatibility metadata. Also `featuredIds`, `categoryMeta`. |
| `src/lib/services.ts` | Deterministic logic: `searchProducts`, `getAlternatives`, `checkCompatibility` (optionally cross-order via `owned`), `recommendPcBuild`, `recommendGamingSetup`, cart helpers, `formatDate`, `productSummary` (compact shape for agent payloads). |
| `src/lib/users.ts` | Mock demo personas (`elina`, `aino`, `sami`) + `guest`. Static seed data, **client bundle** — a demo crutch, not a shippable pattern. |
| `src/lib/orders.ts` | Seeded order history (relative dates materialized at load) + helpers: `getOrdersFor` (paginated), `getOrderDetail`, `returnEligibility` (computed, never reasoned), `ownedHardwareProfile` (derived ≤6-entry profile). |
| `src/lib/shop-context.tsx` | Client state: cart (localStorage), compare, highlights, checkout draft, `activeUser`/`setActiveUser`, session-placed orders, `applySavedAddress`. `useShop()`. |
| `src/app/account/page.tsx` | `/account`: profile, order history with return-state lines, empty state, guest sign-in panel. |
| `src/lib/webmcp.ts` | Optional WebMCP browser-tool registration. Feature-detected; must stay a no-op when unsupported. |
| `src/app/api/copilotkit/route.ts` | CopilotKit runtime endpoint: `BuiltInAgent` + server-side tools + system prompt. |
| `src/components/copilot/shopping-assistant.tsx` | The agentic layer: `CopilotSidebar`, `useAgentContext`, frontend tools, HITL approvals, generative UI renderers for tool results. |
| `src/components/` | Storefront UI: header/footer, product card/grid, catalog browser with filters, compare tray, SVG product visuals. |
| `src/app/` | Routes: `/` home, `/c/[slug]` categories, `/deals`, `/search`, `/product/[id]`, `/cart`, `/checkout`. |

## The agent contract (keep these invariants)

**Server tools** (in `route.ts`, run on the runtime): `searchCatalog`, `getProductDetails`, `getProductAlternatives`, `checkCompatibility`, `recommendPcBuild`, `recommendGamingSetup`. They are deterministic wrappers over `src/lib/services.ts` — the LLM orchestrates and explains; it must never invent products, prices, or stock. They are **user-independent**. `checkCompatibility` takes an optional `owned: { productId, orderNumber, orderedOn }[]` so the check can span across orders and attribute conflicts to a past purchase.

**Frontend tools** (in `shopping-assistant.tsx`, run in the browser): `browseCatalog`, `showProduct`, `goToPage`, `highlightProducts`, `openComparison`, `prefillCheckout` (now also `useSavedAddress`), and the **identity-scoped** `getMyOrders` + `getReturnInfo`. They steer the visible UI via the Next router and `useShop()`.

**Human-in-the-loop** (`useHumanInTheLoop`): `proposeCartUpdate` and `confirmOrder`. These are the *only* paths by which chat can mutate the cart or place an order, and both require a button click from the user. Never add a tool that silently adds to cart, fills payment data, or completes checkout. The `proposeCartUpdate` card runs a **client-side compatibility safety net** against the user's owned hardware, so a conflict surfaces at approval time even if the model missed it — guardrails are structural, not promptual.

Other invariants:

- **Identity is resolved by infrastructure, never passed by the model.** Order history, returns, and the saved address belong to the active persona (`useShop().activeUser`, from localStorage). They are exposed only through *frontend* tools that read the persona directly — there is structurally no `userId` parameter for the model to get wrong, hallucinate, or be talked into changing. (Production note: these become server tools scoped by the authenticated session; the invariant carries over.)
- **The saved address never transits the model.** "Order it to my home address" → `prefillCheckout(useSavedAddress: true)` copies the persona's address straight into checkout state; the tool returns only "Saved address applied". Context carries `hasSavedAddress: true`, never the address text.
- **Returns are computed, never reasoned.** `returnEligibility()` (in `orders.ts`) yields an explicit deadline; the prompt forbids the model from doing date math. Always quote the tool's deadline verbatim.
- Compatibility claims must come from `checkCompatibility` (CPU socket vs motherboard, memory generation, GPU length vs case, PSU headroom, stock) — never from model knowledge. Pass `owned` (the user's `ownedHardware` from context) when signed in.
- Out-of-stock or over-budget requests should route through `getProductAlternatives`.
- Both shopping surfaces (UI and chat) must call the same `src/lib/services.ts` functions. Don't fork business logic into the agent layer.
- WebMCP stays progressive enhancement; core shopping must never depend on it.
- URL query params (`q`, `max`, `brands`, `deals`, `stock`, `sort`) are the source of truth for listing filters — agent navigation and user clicks both go through them.

### Context contract & budget

The agent's `useAgentContext` value is **derived and bounded** — never raw order history. The budget (see [docs/architecture.md](docs/architecture.md) for depth):

| Block | Rule |
|---|---|
| `user` + `ownedHardware` | Derived facts only. `ownedHardware` is one entry per PC-part category, newest wins, ≤6 entries, compat-relevant fields + order provenance. A customer with 1,000 orders yields the same tiny profile. No address text. |
| cart / path / compare / checkout flags | Summaries only; `checkoutForm` carries `complete` (a boolean), not the PII fields. |
| system prompt (`route.ts`) | Personality + calibration + per-flow playbooks + guardrails, kept terse. |
| `searchCatalog` results | ≤8 × `productSummary` (hard cap in the tool). |
| `getMyOrders` results | Paginated: ≤20 summaries/call, default 5. Pagination over bulk. |
| product detail in chat | Render cards look up by **id** client-side; rich data never round-trips through the model. |

The split: **proactive** knowledge (owned hardware, so the agent spontaneously catches cross-order conflicts) lives in always-on context as a derived profile; **reactive** knowledge (order history, returns) lives behind paginated tools and never echoes raw.

## Personas, order history & the adaptive agent (implemented)

The personas and customer-memory layer are fully implemented. What's included:

- **Personas** (`users.ts`): `guest` + Elina (new, empty), Aino (returning builder, 3 orders), Sami (power user, 28 orders). Switch via the header avatar menu; selection lives in `voltti.user.v1`. `/account` shows profile + order history with return-state lines.
- **Order history & returns** (`orders.ts`): seeded relative-date orders, paginated `getMyOrders`, `getReturnInfo` with computed deadlines.
- **Cross-order compatibility**: `checkCompatibility(productIds, owned)` attributes conflicts to the order a part came from; a Wi-Fi-adapter-vs-built-in-Wi-Fi redundancy *note*; the `proposeCartUpdate` approval-card safety net.
- **Adaptive interaction + system prompt v2**: fast path for fully-specified requests, guided path for novices — calibration, playbooks, and guardrails in `route.ts`. The two HITL approvals never adapt away.
- **Context discipline**: derived owned-hardware profile in context, everything else behind tools — see the budget table above.

`DEMO.md` has the persona walkthrough; [docs/architecture.md](docs/architecture.md) and [docs/agent-contract.md](docs/agent-contract.md) cover the design rationale.

## Working on the code

```bash
npm run dev          # dev server on :3000
npm run typecheck    # tsc --noEmit — run after changes
npm run lint         # eslint
npm run build        # production build (prerenders all product/category pages)
```

- Verify CopilotKit v2 API signatures against the installed package `.d.mts` files in `node_modules/@copilotkit/*/dist/` rather than assuming — the v2 surface evolves quickly. Note: `useRenderTool` takes `parameters:` (a zod schema) and its `render` receives `result` as a **string** (JSON-parse it defensively).
- Adding products: edit `src/lib/catalog.ts`; keep realistic names/specs/prices, set `compat` for PC parts (that's what powers the warnings demo), include a few deals (`originalPrice`) and out-of-stock items (`stock: 0`) so the alternative-suggestion flows stay demoable.
- Adding an agent capability: implement deterministic logic in `services.ts` → expose as a server tool (data) or frontend tool (UI action) → add a generative-UI renderer if the result benefits from a card in chat.

## Environment

```bash
COPILOTKIT_MODEL=anthropic:claude-sonnet-4-6   # "provider/model" or "provider:model"; openai/... and google/... also work
ANTHROPIC_API_KEY=...                          # key matching the provider
```

Without a key the storefront still works; only live chat runs fail. See `.env.example`.
