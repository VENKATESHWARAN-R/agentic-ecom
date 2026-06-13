# Voltti — Agentic E-commerce POC

Voltti is a proof-of-concept electronics store (EUR pricing, Nordic flavor) split into two services:

- **Storefront** — a Next.js app (this repo root): browse categories, filter and sort, compare products, manage a cart, run a mock checkout, chat with the assistant.
- **Agent backend** — a uv-managed Python service ([backend/](backend/)): the shopping agent (Pydantic AI, speaking the [AG-UI protocol](https://docs.ag-ui.com) to CopilotKit), the deterministic domain logic, a REST API, and a SQLite database that owns all order data.

The split means the agentic system — system prompt, tools, model choice — is managed and deployed separately from the application code. Editing [backend/src/voltti_backend/agent/prompt.md](backend/src/voltti_backend/agent/prompt.md) changes the agent's behavior without touching the storefront.

It demonstrates two ways to shop the same catalog:

1. **Traditional UI** — browse categories, filter and sort, compare products, manage a cart, run a mock checkout.
2. **Agentic chat** — a sidebar assistant that searches the catalog, recommends and compares products, flags PC-part incompatibilities, suggests in-stock alternatives, steers the storefront UI, and builds the cart or places orders only with explicit human approval.

## Architecture (one paragraph)

The catalog and personas are seeded from shared JSON files in [data/](data/) — the Next.js bundle imports them for instant rendering and static generation, and the backend loads them into SQLite at startup, so product facts never drift. Orders are runtime data and live **only** in the backend database: the storefront places and reads them over REST, and the agent's order knowledge (history, returns, the derived owned-hardware profile) comes from the same database. Chat flows from the CopilotKit sidebar through `/api/copilotkit` (a thin `HttpAgent` bridge) to the Python agent over AG-UI; frontend tools, human-in-the-loop approvals, and generative UI cards stay in the browser. The Python domain logic is a faithful port of the original TypeScript and is locked to it by parity fixtures (`backend/tests/`).

## Features

- Real storefront routes: home, 8 category pages with filter sidebar, deals, search, product detail, cart, checkout with order confirmation, and an `/account` page.
- 61 realistic products (iPhone 16 Pro, Ryzen 7 9800X3D, RTX 5090, Legion Pro 5, …) with deals, out-of-stock demo items, and PC compatibility metadata.
- Product comparison tray + modal with a spec table and automatic PC-part compatibility notice.
- **Demo personas** (guest + three accounts) with seeded order history and an `/account` page — switch from the header avatar menu.
- **Customer memory**: the assistant answers order/return questions with computed deadlines and flags *cross-order* PC-part conflicts ("the AM5 board from your order VLT-1002…"). Owned hardware enters context as a derived, bounded profile; order history stays paginated behind tools; the saved address never reaches the model.
- **Adaptive interaction**: a fast path for fully-specified requests (two clicks to order) and a guided, one-question-at-a-time path for novices.
- A Pydantic AI agent with catalog tools (search, details, alternatives, cross-order compatibility check, PC-build and gaming-setup advisors), frontend tools (navigation, highlighting, comparison, checkout prefill + saved address, order history, returns), and human-in-the-loop approvals (with a client-side compatibility safety net) for cart updates and orders.
- Generative UI cards in chat for search results, alternatives, compatibility verdicts, recommended builds, order lists, and return status.
- WebMCP progressive enhancement: `search_catalog`, `open_page`, and `add_to_cart` exposed via `navigator.modelContext` in browsers that support it.

## Demo Script Ideas

See **[DEMO.md](DEMO.md)** for the full walkthrough script (16 scenarios with exact prompts, what to watch for, the seeded demo products, and the demo personas). Highlights:

- "Any discounted phones under €500?" — catalog search, deal filtering, UI steering to the listing.
- "I picked an Intel Core Ultra CPU and an AM5 motherboard" — the compatibility check names the socket mismatch and suggests a fix.
- "I want the RTX 5070" — it's out of stock; the agent says so and offers in-stock alternatives.
- "Build me a gaming PC for €1500" — the part-picker allocates the budget, keeps the platform consistent, and renders the build as a card.
- *(as Aino)* "Can I still return the motherboard I ordered?" — exact return deadline from a computed check; "add an Intel i7" then flags it against the AM5 board she already owns.
- *(as Sami)* "RTX 5090, order it to my home address" — the expert fast path: two clicks, saved address never shown in chat.
- Chat-driven checkout — give the assistant your delivery details, let it prefill the form, then approve the order via the confirmation button. No order is ever placed without that click.

## Quick Start

Two processes: the Python backend (`:8000`) and the Next.js storefront (`:3000`).

```bash
# One-time setup
npm install
cp .env.example .env          # add a provider API key (e.g. ANTHROPIC_API_KEY)
cd backend && uv sync && cd ..

# Run both (backend + storefront) with one command…
./scripts/dev.sh

# …or in two terminals:
cd backend && uv run uvicorn voltti_backend.main:app --reload --port 8000
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The storefront browsing works without an API key; chat and order history need the backend running, and live chat needs a key.

## Environment

Root `.env` (shared — the backend reads it too):

```bash
COPILOTKIT_MODEL=anthropic:claude-sonnet-4-6   # agent model, "provider:model"
ANTHROPIC_API_KEY=...                          # key matching the provider
AGENT_URL=http://localhost:8000/agui           # AG-UI endpoint (server-side)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000  # REST base (browser-side)
```

`openai:...` (needs `OPENAI_API_KEY`) and `google:...` (needs `GOOGLE_API_KEY`) also work. The backend can override the model with `AGENT_MODEL` in `backend/.env` — see [backend/.env.example](backend/.env.example).

## Docker

```bash
cp .env.example .env
docker compose up --build     # storefront on :3000, agent backend on :8000
```

## Project Structure

| Path | What it is |
|---|---|
| `data/catalog.json`, `data/users.json` | **Shared seed data** — single source for both the Next.js bundle and the backend DB |
| `backend/` | uv-managed Python service: agent, domain logic, REST API, SQLite |
| `backend/src/voltti_backend/agent/prompt.md` | The agent's system prompt — edit freely, no app code changes |
| `backend/src/voltti_backend/agent/agent.py` | Pydantic AI agent + the six catalog tools |
| `backend/src/voltti_backend/domain/` | Deterministic search/compat/recommendation/order logic (Python port, parity-tested) |
| `backend/src/voltti_backend/api/routes.py` | REST API: products, users, orders, agent profile |
| `backend/tests/` | Parity tests (vs the TS implementation) + API integration tests |
| `scripts/generate-parity-fixtures.ts` | Regenerates the parity fixtures from the TS domain logic |
| `src/lib/types.ts` | Domain types (`Product`, `Compat`, `CartLine`, `Order`, `UserProfile`, …) |
| `src/lib/catalog.ts` | Catalog access (typed wrapper over `data/catalog.json`) + `featuredIds`, `categoryMeta` |
| `src/lib/services.ts` | Client-side search/compat/format helpers for the UI (compare tray, listings, HITL safety net) |
| `src/lib/users.ts` | Demo personas (typed wrapper over `data/users.json`) |
| `src/lib/api.ts` | Typed client for the backend REST API (orders, personas, agent profile) |
| `src/lib/shop-context.tsx` | Client state: cart (localStorage), active persona, compare, highlights, checkout draft |
| `src/app/api/copilotkit/route.ts` | CopilotKit runtime: `HttpAgent` bridge to the Python agent over AG-UI |
| `src/components/copilot/shopping-assistant.tsx` | Sidebar, agent context, frontend tools, HITL approvals, generative UI |
| `src/components/` | Storefront UI components |
| `src/app/` | Routes: `/`, `/c/[slug]`, `/deals`, `/search`, `/product/[id]`, `/cart`, `/checkout`, `/account` |

## Documentation

Start with [docs/README.md](docs/README.md): [Architecture](docs/architecture.md) · [Agent Contract](docs/agent-contract.md) · [Features](docs/features.md) · [Design](docs/design.md) · [Runbook](docs/runbook.md)

## Commands

```bash
# Storefront
npm run dev          # dev server on :3000
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # production build
npm run start        # serve the build

# Backend (from backend/)
uv sync                                                    # install deps
uv run uvicorn voltti_backend.main:app --reload --port 8000   # dev server on :8000
uv run pytest                                              # parity + API tests

# Both
./scripts/dev.sh     # backend + storefront together

# After changing the TS domain logic in src/lib/services.ts
npx tsx scripts/generate-parity-fixtures.ts && cd backend && uv run pytest
```
