# Voltti — Agentic E-commerce POC

Voltti is a proof-of-concept electronics store (EUR pricing, Nordic flavor) built with Next.js and CopilotKit. It demonstrates two ways to shop the same catalog:

1. **Traditional UI** — browse categories, filter and sort, compare products, manage a cart, run a mock checkout.
2. **Agentic chat** — a sidebar assistant that searches the catalog, recommends and compares products, flags PC-part incompatibilities, suggests in-stock alternatives, steers the storefront UI, and builds the cart or places orders only with explicit human approval.

Both paths call the same deterministic domain services in `src/lib/services.ts`, so product facts never drift between the UI and the agent.

## Features

- Real storefront routes: home, 8 category pages with filter sidebar, deals, search, product detail, cart, checkout with order confirmation, and an `/account` page.
- 61 realistic products (iPhone 16 Pro, Ryzen 7 9800X3D, RTX 5090, Legion Pro 5, …) with deals, out-of-stock demo items, and PC compatibility metadata.
- Product comparison tray + modal with a spec table and automatic PC-part compatibility notice.
- **Demo personas** (guest + three accounts) with seeded order history and an `/account` page — switch from the header avatar menu.
- **Customer memory**: the assistant answers order/return questions with computed deadlines and flags *cross-order* PC-part conflicts ("the AM5 board from your order VLT-1002…"). Owned hardware enters context as a derived, bounded profile; order history stays paginated behind tools; the saved address never reaches the model.
- **Adaptive interaction**: a fast path for fully-specified requests (two clicks to order) and a guided, one-question-at-a-time path for novices.
- CopilotKit v2 BuiltInAgent with server tools (catalog search, details, alternatives, cross-order compatibility check, PC-build and gaming-setup advisors), frontend tools (navigation, highlighting, comparison, checkout prefill + saved address, order history, returns), and human-in-the-loop approvals (with a client-side compatibility safety net) for cart updates and orders.
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

```bash
npm install
cp .env.example .env   # add a provider API key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The storefront works without any API key; only live chat needs one.

## Environment

```bash
COPILOTKIT_MODEL=anthropic:claude-sonnet-4-6   # "provider:model" or "provider/model"
ANTHROPIC_API_KEY=...                          # key matching the provider
```

`openai/...` (needs `OPENAI_API_KEY`) and `google/...` (needs `GOOGLE_API_KEY`) also work. See `.env.example`.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

## Project Structure

| Path | What it is |
|---|---|
| `src/lib/types.ts` | Domain types (`Product`, `Compat`, `CartLine`, `Order`, `UserProfile`, …) |
| `src/lib/catalog.ts` | In-memory product catalog (61 products) |
| `src/lib/services.ts` | Deterministic search, alternatives, cross-order compatibility, and recommendation logic |
| `src/lib/users.ts` | Demo personas (static seed data) |
| `src/lib/orders.ts` | Seeded order history + returns / owned-hardware helpers |
| `src/lib/shop-context.tsx` | Client state: cart (localStorage), active persona, session orders, compare, highlights, checkout draft |
| `src/app/api/copilotkit/route.ts` | CopilotKit runtime: BuiltInAgent + server tools + system prompt v2 |
| `src/components/copilot/shopping-assistant.tsx` | Sidebar, agent context, frontend tools, HITL approvals, generative UI |
| `src/components/` | Storefront UI components |
| `src/app/` | Routes: `/`, `/c/[slug]`, `/deals`, `/search`, `/product/[id]`, `/cart`, `/checkout`, `/account` |

## Documentation

Start with [docs/README.md](docs/README.md): [Architecture](docs/architecture.md) · [Agent Contract](docs/agent-contract.md) · [Features](docs/features.md) · [Design](docs/design.md) · [Runbook](docs/runbook.md)

## Commands

```bash
npm run dev          # dev server on :3000
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # production build
npm run start        # serve the build
```
