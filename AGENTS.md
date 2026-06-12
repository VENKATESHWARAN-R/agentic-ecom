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
| `src/lib/types.ts` | Domain types: `Product`, `Compat`, `CartLine`, `SearchFilters`, etc. Start here. |
| `src/lib/catalog.ts` | ~59 realistic products with specs, stock, deals, and PC compatibility metadata. Also `featuredIds`, `categoryMeta`. |
| `src/lib/services.ts` | Deterministic logic: `searchProducts`, `getAlternatives`, `checkCompatibility`, `recommendPcBuild`, `recommendGamingSetup`, cart helpers, `productSummary` (compact shape for agent payloads). |
| `src/lib/shop-context.tsx` | Client state: cart (persisted to localStorage), compare selection, highlights, checkout draft, orders. `useShop()`. |
| `src/lib/webmcp.ts` | Optional WebMCP browser-tool registration. Feature-detected; must stay a no-op when unsupported. |
| `src/app/api/copilotkit/route.ts` | CopilotKit runtime endpoint: `BuiltInAgent` + server-side tools + system prompt. |
| `src/components/copilot/shopping-assistant.tsx` | The agentic layer: `CopilotSidebar`, `useAgentContext`, frontend tools, HITL approvals, generative UI renderers for tool results. |
| `src/components/` | Storefront UI: header/footer, product card/grid, catalog browser with filters, compare tray, SVG product visuals. |
| `src/app/` | Routes: `/` home, `/c/[slug]` categories, `/deals`, `/search`, `/product/[id]`, `/cart`, `/checkout`. |

## The agent contract (keep these invariants)

**Server tools** (in `route.ts`, run on the runtime): `searchCatalog`, `getProductDetails`, `getProductAlternatives`, `checkCompatibility`, `recommendPcBuild`, `recommendGamingSetup`. They are deterministic wrappers over `src/lib/services.ts` — the LLM orchestrates and explains; it must never invent products, prices, or stock.

**Frontend tools** (in `shopping-assistant.tsx`, run in the browser): `browseCatalog`, `showProduct`, `goToPage`, `highlightProducts`, `openComparison`, `prefillCheckout`. They steer the visible UI via the Next router and `useShop()`.

**Human-in-the-loop** (`useHumanInTheLoop`): `proposeCartUpdate` and `confirmOrder`. These are the *only* paths by which chat can mutate the cart or place an order, and both require a button click from the user. Never add a tool that silently adds to cart, fills payment data, or completes checkout.

Other invariants:

- Compatibility claims must come from `checkCompatibility` (CPU socket vs motherboard, memory generation, GPU length vs case, PSU headroom, stock) — never from model knowledge.
- Out-of-stock or over-budget requests should route through `getProductAlternatives`.
- Both shopping surfaces (UI and chat) must call the same `src/lib/services.ts` functions. Don't fork business logic into the agent layer.
- WebMCP stays progressive enhancement; core shopping must never depend on it.
- URL query params (`q`, `max`, `brands`, `deals`, `stock`, `sort`) are the source of truth for listing filters — agent navigation and user clicks both go through them.

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
