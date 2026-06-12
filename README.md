# Voltti — Agentic E-commerce POC

Voltti is a proof-of-concept electronics store (EUR pricing, Nordic flavor) built with Next.js and CopilotKit. It demonstrates two ways to shop the same catalog:

1. **Traditional UI** — browse categories, filter and sort, compare products, manage a cart, run a mock checkout.
2. **Agentic chat** — a sidebar assistant that searches the catalog, recommends and compares products, flags PC-part incompatibilities, suggests in-stock alternatives, steers the storefront UI, and builds the cart or places orders only with explicit human approval.

Both paths call the same deterministic domain services in `src/lib/services.ts`, so product facts never drift between the UI and the agent.

## Features

- Real storefront routes: home, 8 category pages with filter sidebar, deals, search, product detail, cart, checkout with order confirmation.
- ~59 realistic products (iPhone 16 Pro, Ryzen 7 9800X3D, RTX 5080, Legion Pro 5, …) with deals, out-of-stock demo items, and PC compatibility metadata.
- Product comparison tray + modal with a spec table and automatic PC-part compatibility notice.
- CopilotKit v2 BuiltInAgent with server tools (catalog search, details, alternatives, compatibility check, PC-build and gaming-setup advisors), frontend tools (navigation, highlighting, comparison, checkout prefill), and human-in-the-loop approvals for cart updates and orders.
- Generative UI cards in chat for search results, alternatives, compatibility verdicts, and recommended builds.
- WebMCP progressive enhancement: `search_catalog`, `open_page`, and `add_to_cart` exposed via `navigator.modelContext` in browsers that support it.

## Demo Script Ideas

- "Any discounted phones under €500?" — catalog search, deal filtering, UI steering to the listing.
- "I picked an Intel Core Ultra CPU and an AM5 motherboard" — the compatibility check names the socket mismatch and suggests a fix.
- "I want the RTX 5070" — it's out of stock; the agent says so and offers in-stock alternatives.
- "Build me a gaming PC for €1500" — the part-picker allocates the budget, keeps the platform consistent, and renders the build as a card.
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
| `src/lib/types.ts` | Domain types (`Product`, `Compat`, `CartLine`, …) |
| `src/lib/catalog.ts` | In-memory product catalog |
| `src/lib/services.ts` | Deterministic search, alternatives, compatibility, and recommendation logic |
| `src/lib/shop-context.tsx` | Client state: cart (localStorage), compare, highlights, checkout draft, orders |
| `src/app/api/copilotkit/route.ts` | CopilotKit runtime: BuiltInAgent + server tools |
| `src/components/copilot/shopping-assistant.tsx` | Sidebar, agent context, frontend tools, HITL approvals, generative UI |
| `src/components/` | Storefront UI components |
| `src/app/` | Routes: `/`, `/c/[slug]`, `/deals`, `/search`, `/product/[id]`, `/cart`, `/checkout` |

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
