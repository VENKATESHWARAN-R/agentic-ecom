# Voltti — Agentic E-commerce POC

Guidance for AI agents working in this repository.

> **🔒 Read the principles first.** Before any change-related decision or code change, read **[docs/security-principles.md](docs/security-principles.md)** and ensure your change complies. Cite the principle it upholds — or the explicit trade-off it makes. The binding principles **P1–P7** are non-negotiable (determinism boundary, the LLM authorizes nothing, structural guardrails, server-resolved identity, least-privilege tiered tools, data minimization, observability & limits); **P8–P9** are aspirational. New tools must declare a risk tier.

## What this project is

A proof-of-concept electronics storefront ("Voltti", EUR pricing) where users shop two ways:

1. **Traditional UI** — browse categories, filter, compare, cart, mock checkout.
2. **Agentic chat** — a CopilotKit-powered assistant that searches the catalog, recommends and compares products, flags PC-part incompatibilities, suggests in-stock alternatives, steers the UI, and builds the cart / places orders **only with explicit human approval**.

The system is split into two services: the **Next.js storefront** (repo root) and the **agent backend** (`backend/`, uv-managed Python) hosting the Pydantic AI shopping agent (over the AG-UI protocol), the deterministic domain logic, a REST API, and SQLite. The catalog/persona seed data is shared via `data/*.json`; orders live only in the backend DB.

**Demo surface, production-grade depth.** The UI, the 61-product catalog, and the personas are deliberately fake — but the **architecture, security design, and agentic orchestration are real, production-grade work, and the actual point of this project**: a reference-quality, secure agentic implementation on generative UI. So there is no real payment rail, identity provider, or external commerce API, and the only database is the backend's SQLite (seeded on startup) — yet identity, authorization, the tool gateway, limits, and observability are built to a real production shape with mock credentials. The depth lives in the design, not the surface. See [docs/security-principles.md](docs/security-principles.md).

## Stack

- Next.js (App Router) + React + TypeScript, plain CSS in `src/app/globals.css` (no Tailwind in app code)
- CopilotKit v2 APIs from **`@copilotkit/react-core/v2`** (client) and **`@copilotkit/runtime`** (server). The non-`/v2` react imports are the legacy v1 API — do not mix them in. The runtime route is a thin `HttpAgent` (from `@ag-ui/client`) bridge to the Python agent.
- Zod for frontend tool parameter schemas
- Backend: Python 3.12 managed with **uv** (`cd backend && uv sync`), FastAPI + Pydantic AI (`pydantic-ai-slim[ag-ui,...]`), SQLModel/SQLite. The Python domain layer is a parity-tested port of `src/lib/services.ts` — change both together and run the parity suite.

## Map of the code

| Path | What it is |
|---|---|
| `src/lib/types.ts` | Domain types: `Product`, `Compat`, `CartLine`, `SearchFilters`, `Order`, `UserProfile`, `PersonaId`, `ReturnEligibility`, `OwnedPart`, etc. Start here. |
| `data/catalog.json` / `data/users.json` | **Shared seed data** (61 products / 3 personas) consumed by both the Next.js bundle and the backend DB seed. Edit products HERE. |
| `backend/src/voltti_backend/agent/prompt.md` | The agent's system prompt. Edit to change behavior — no app code involved. |
| `backend/src/voltti_backend/agent/agent.py` | Pydantic AI agent: model from env, 6 catalog tools (names must keep matching the frontend renderers), per-request context injection. |
| `backend/src/voltti_backend/domain/` | Python port of the domain logic (catalog/compat/builds/orders/format). Parity-locked to the TS via `backend/tests/test_parity.py`. |
| `backend/src/voltti_backend/api/routes.py` | REST API: products, users, order summaries/details, agent profile, order placement. |
| `backend/src/voltti_backend/db.py` | SQLite engine + startup seeding (catalog/users from `data/`, demo orders with fresh relative dates). |
| `src/lib/catalog.ts` | Typed wrapper over `data/catalog.json`. Also `featuredIds`, `categoryMeta`. |
| `src/lib/services.ts` | Deterministic logic: `searchProducts`, `getAlternatives`, `checkCompatibility` (optionally cross-order via `owned`), `recommendPcBuild`, `recommendGamingSetup`, cart helpers, `formatDate`, `productSummary` (compact shape for agent payloads). |
| `src/lib/users.ts` | Mock demo personas (`elina`, `aino`, `sami`) + `guest`. Static seed data, **client bundle** — a demo crutch, not a shippable pattern. |
| `src/lib/api.ts` | Typed client for the backend REST API: orders, personas, agent profile, order placement. |
| `src/lib/shop-context.tsx` | Client state: cart (localStorage), compare, highlights, checkout draft, `activeUser`/`setActiveUser`, async `placeOrder` (POSTs to the backend), `applySavedAddress`. `useShop()`. |
| `src/app/account/page.tsx` | `/account`: profile, order history with return-state lines, empty state, guest sign-in panel. |
| `src/lib/webmcp.ts` | Optional WebMCP browser-tool registration. Feature-detected; must stay a no-op when unsupported. |
| `src/app/api/copilotkit/route.ts` | CopilotKit runtime endpoint: thin `HttpAgent` bridge to the Python agent (`AGENT_URL`). No agent logic here. |
| `src/components/copilot/shopping-assistant.tsx` | The agentic layer: `CopilotSidebar`, `useAgentContext`, frontend tools, HITL approvals, generative UI renderers for tool results. |
| `src/components/` | Storefront UI: header/footer, product card/grid, catalog browser with filters, compare tray, SVG product visuals. |
| `src/app/` | Routes: `/` home, `/c/[slug]` categories, `/deals`, `/search`, `/product/[id]`, `/cart`, `/checkout`. |

## The agent contract (keep these invariants)

**Agent tools** (in `backend/.../agent/agent.py`, run in the Python backend): `searchCatalog`, `getProductDetails`, `getProductAlternatives`, `checkCompatibility`, `recommendPcBuild`, `recommendGamingSetup` (deterministic, **user-independent** catalog wrappers), plus the **identity-scoped** `getMyOrders` + `getReturnInfo`. The LLM orchestrates and explains; it must never invent products, prices, or stock. The identity-scoped tools read the session identity from the BFF assertion via `deps` (never a model parameter) and pass the tool gateway (`agent/policy.py`) — see [docs/security-implementation.md](docs/security-implementation.md). `checkCompatibility` takes an optional `owned: { productId, orderNumber, orderedOn }[]` so the check can span across orders and attribute conflicts to a past purchase. **Tool names must stay in sync with the `useRenderTool` renderers in `shopping-assistant.tsx`.**

**Frontend tools** (in `shopping-assistant.tsx`, run in the browser): `browseCatalog`, `showProduct`, `goToPage`, `highlightProducts`, `openComparison`, `prefillCheckout` (now also `useSavedAddress`). They steer the visible UI via the Next router and `useShop()`. (`getMyOrders`/`getReturnInfo` moved to identity-scoped **backend** tools — the browser only renders their result cards via `useRenderTool`.)

**Human-in-the-loop** (`useHumanInTheLoop`): `proposeCartUpdate` and `confirmOrder`. These are the *only* paths by which chat can mutate the cart or place an order, and both require a button click from the user. Never add a tool that silently adds to cart, fills payment data, or completes checkout. The `proposeCartUpdate` card runs a **client-side compatibility safety net** against the user's owned hardware, so a conflict surfaces at approval time even if the model missed it — guardrails are structural, not promptual.

Other invariants:

- **Identity is resolved by infrastructure, never passed by the model.** Order history and returns belong to the signed-in customer, resolved from the **BFF session** (httpOnly signed cookie → server-minted assertion), never the browser or the model. They are exposed through identity-scoped **backend** tools (`getMyOrders`/`getReturnInfo`) scoped to `deps.identity` behind the tool gateway — there is structurally no `userId` parameter for the model to get wrong, hallucinate, or be talked into changing. (The saved address still belongs to the active persona client-side, applied via `prefillCheckout(useSavedAddress)`; see [docs/security-implementation.md](docs/security-implementation.md).)
- **The saved address never transits the model.** "Order it to my home address" → `prefillCheckout(useSavedAddress: true)` copies the persona's address straight into checkout state; the tool returns only "Saved address applied". Context carries `hasSavedAddress: true`, never the address text.
- **Returns are computed, never reasoned.** `return_eligibility()` (backend `domain/orders.py`) yields an explicit deadline; the prompt forbids the model from doing date math. Always quote the tool's deadline verbatim.
- Compatibility claims must come from `checkCompatibility` (CPU socket vs motherboard, memory generation, GPU length vs case, PSU headroom, stock) — never from model knowledge. Pass `owned` (the user's `ownedHardware` from context) when signed in.
- Out-of-stock or over-budget requests should route through `getProductAlternatives`.
- The backend domain layer is the agent's source of truth; the client-side helpers in `src/lib/services.ts` (listing filters, compare tray, HITL safety net) must stay behavior-identical — after changing either side, regenerate fixtures (`npx tsx scripts/generate-parity-fixtures.ts`) and run `cd backend && uv run pytest`.
- WebMCP stays progressive enhancement; core shopping must never depend on it.
- URL query params (`q`, `max`, `brands`, `deals`, `stock`, `sort`) are the source of truth for listing filters — agent navigation and user clicks both go through them.

### Context contract & budget

The agent's `useAgentContext` value is **derived and bounded** — never raw order history. The budget (see [docs/architecture.md](docs/architecture.md) for depth):

| Block | Rule |
|---|---|
| `user` + `ownedHardware` | Derived facts only. `ownedHardware` is one entry per PC-part category, newest wins, ≤6 entries, compat-relevant fields + order provenance. A customer with 1,000 orders yields the same tiny profile. No address text. |
| cart / path / compare / checkout flags | Summaries only; `checkoutForm` carries `complete` (a boolean), not the PII fields. |
| system prompt (`backend/.../agent/prompt.md`) | Personality + calibration + per-flow playbooks + guardrails, kept terse. |
| `searchCatalog` results | ≤8 × `productSummary` (hard cap in the tool). |
| `getMyOrders` results | Paginated: ≤20 summaries/call, default 5. Pagination over bulk. |
| product detail in chat | Render cards look up by **id** client-side; rich data never round-trips through the model. |

The split: **proactive** knowledge (owned hardware, so the agent spontaneously catches cross-order conflicts) lives in always-on context as a derived profile; **reactive** knowledge (order history, returns) lives behind paginated tools and never echoes raw.

## Personas, order history & the adaptive agent (implemented)

The personas and customer-memory layer are fully implemented. What's included:

- **Personas** (`users.ts`): `guest` + Elina (new, empty), Aino (returning builder, 3 orders), Sami (power user, 28 orders). Switch via the header avatar menu; selection lives in `voltti.user.v1`. `/account` shows profile + order history with return-state lines.
- **Order history & returns** (backend DB + `domain/orders.py`): seeded relative-date orders (regenerated each startup), paginated `getMyOrders`, `getReturnInfo` with computed deadlines — all served over REST.
- **Cross-order compatibility**: `checkCompatibility(productIds, owned)` attributes conflicts to the order a part came from; a Wi-Fi-adapter-vs-built-in-Wi-Fi redundancy *note*; the `proposeCartUpdate` approval-card safety net.
- **Adaptive interaction + system prompt v2**: fast path for fully-specified requests, guided path for novices — calibration, playbooks, and guardrails in `backend/.../agent/prompt.md`. The two HITL approvals never adapt away.
- **Context discipline**: derived owned-hardware profile in context, everything else behind tools — see the budget table above.

`DEMO.md` has the persona walkthrough; [docs/architecture.md](docs/architecture.md) and [docs/agent-contract.md](docs/agent-contract.md) cover the design rationale.

## Working on the code

```bash
./scripts/dev.sh     # backend (:8000) + storefront (:3000) together

npm run dev          # storefront dev server on :3000
npm run typecheck    # tsc --noEmit — run after changes
npm run lint         # eslint
npm run build        # production build (prerenders all product/category pages)

cd backend
uv sync              # install backend deps
uv run uvicorn voltti_backend.main:app --reload --port 8000
uv run pytest        # parity + API tests — run after backend or domain changes
```

- Verify CopilotKit v2 API signatures against the installed package `.d.mts` files in `node_modules/@copilotkit/*/dist/` rather than assuming — the v2 surface evolves quickly. Note: `useRenderTool` takes `parameters:` (a zod schema) and its `render` receives `result` as a **string** (JSON-parse it defensively).
- Frontend tool registration gotcha: `useFrontendTool`/`useHumanInTheLoop` decide re-registration by `JSON.stringify(deps)` — **functions stringify to null and never trigger an update**, leaving stale closures. Depend on the underlying serializable state (e.g. `[personaId]`), never on callbacks.
- Adding products: edit `data/catalog.json`; keep realistic names/specs/prices, set `compat` for PC parts (that's what powers the warnings demo), include a few deals (`originalPrice`) and out-of-stock items (`stock: 0`) so the alternative-suggestion flows stay demoable. Both services pick the file up (backend re-seeds on restart).
- Adding an agent capability: implement deterministic logic in `backend/.../domain/` → expose as an agent tool (data) in `agent.py` or a frontend tool (UI action) in `shopping-assistant.tsx` → add a generative-UI renderer if the result benefits from a card in chat. Mirror any UI-relevant logic in `src/lib/services.ts` and extend the parity fixtures.
- Changing agent behavior (tone, flows, guardrails): edit `backend/src/voltti_backend/agent/prompt.md` only.

## Environment

```bash
COPILOTKIT_MODEL=anthropic:claude-sonnet-4-6   # agent model ("provider:model", Pydantic AI format); AGENT_MODEL in backend/.env overrides
ANTHROPIC_API_KEY=...                          # key matching the provider (root .env is enough; the backend loads it)
AGENT_URL=http://localhost:8000/agui           # Next.js → backend AG-UI endpoint
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000  # browser → backend REST API
```

Without a key the storefront still works; only live chat runs fail. See `.env.example` and `backend/.env.example`.
