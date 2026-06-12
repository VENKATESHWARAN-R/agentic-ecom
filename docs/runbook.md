# Runbook

Setup, configuration, Docker, and validation for Voltti.

## Prerequisites

- Node.js 22 and npm.
- One model provider API key for live chat (the storefront itself needs none).
- Docker if using Compose.

## Local Setup

```bash
npm install
cp .env.example .env   # set COPILOTKIT_MODEL and the matching key
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

### `COPILOTKIT_MODEL`

Selects the model for the CopilotKit BuiltInAgent. Both `provider:model` and `provider/model` forms parse:

```bash
COPILOTKIT_MODEL=anthropic:claude-sonnet-4-6
COPILOTKIT_MODEL=anthropic/claude-3.5-haiku
COPILOTKIT_MODEL=openai/gpt-4o-mini
COPILOTKIT_MODEL=google/gemini-2.5-flash
```

If unset, the runtime falls back to `openai/gpt-4o-mini` (see `src/app/api/copilotkit/route.ts`).

### Provider Keys

Set the key matching the provider prefix:

- `anthropic` → `ANTHROPIC_API_KEY`
- `openai` → `OPENAI_API_KEY`
- `google` → `GOOGLE_API_KEY`

### Optional

```bash
COPILOTKIT_TELEMETRY_DISABLED=true
PORT=3000
```

## Docker

```bash
cp .env.example .env   # set model + key
docker compose up --build
```

The multi-stage Dockerfile runs `npm run build` and serves with `next start` on port 3000; `docker-compose.yml` passes `COPILOTKIT_MODEL` and the provider keys through from `.env` (or the shell):

```bash
COPILOTKIT_MODEL=anthropic:claude-sonnet-4-6 ANTHROPIC_API_KEY=... docker compose up --build
```

Stop with `docker compose down`.

## Validation

Run before handing off changes:

```bash
npm run typecheck
npm run lint
npm run build   # also prerenders all category and product pages
```

Manual smoke test:

1. Browse a category, apply a max-price filter, confirm the URL query updates.
2. Open a product page, add to cart, change quantity in the cart, proceed through the mock checkout to the confirmation screen.
3. Select two PC parts for comparison (e.g. an Intel CPU and an AM5 board) and confirm the compatibility warning appears in the modal.
4. Open the assistant and ask for discounted phones under €500 — it should search, open the filtered listing, and render result cards in chat.
5. Ask it to add a product to the cart — an approval card must appear; nothing is added until you click.

## Troubleshooting

- **Storefront loads, chat fails** — the provider key doesn't match `COPILOTKIT_MODEL`, or the model name is invalid. The app renders regardless; only runtime calls fail.
- **Cart looks empty on first paint** — cart state hydrates from localStorage after mount (`voltti.cart.v1`); this is expected for a frame.
- **Port 3000 in use** — `npm run dev -- -p 3001`, or change the port mapping in `docker-compose.yml`.
- **Compatibility warning missing** — the parts involved need `compat` metadata in `src/lib/catalog.ts` (CPU/board need `socket`, GPU needs `gpuLengthMm`, etc.).
