# Runbook

Setup, configuration, Docker, and validation for Voltti (storefront + agent backend).

## Prerequisites

- Node.js 22 and npm (storefront).
- [uv](https://docs.astral.sh/uv/) and Python 3.12+ (agent backend).
- One model provider API key for live chat (browsing the storefront needs none).
- Docker if using Compose.

## Local Setup

```bash
npm install
cp .env.example .env            # set COPILOTKIT_MODEL and the matching key
cd backend && uv sync && cd ..

./scripts/dev.sh                # backend on :8000 + storefront on :3000
```

Or in two terminals:

```bash
cd backend && uv run uvicorn voltti_backend.main:app --reload --port 8000
npm run dev
```

Open `http://localhost:3000`. The backend re-seeds the catalog, personas, and demo order history (fresh relative dates) on every startup; orders you place persist in `backend/voltti.db`.

## Environment Variables

### Model selection

The agent runs in the Python backend and reads, in order: `AGENT_MODEL` (backend/.env), `COPILOTKIT_MODEL` (root .env, kept for continuity), then defaults to `anthropic:claude-sonnet-4-6`. Pydantic AI `provider:model` format:

```bash
AGENT_MODEL=anthropic:claude-sonnet-4-6
AGENT_MODEL=openai:gpt-4o-mini
AGENT_MODEL=google:gemini-2.5-flash
```

### Provider keys

Set the key matching the provider prefix (root `.env` is enough — the backend loads it too):

- `anthropic` → `ANTHROPIC_API_KEY`
- `openai` → `OPENAI_API_KEY`
- `google` → `GOOGLE_API_KEY`

### Service wiring

```bash
AGENT_URL=http://localhost:8000/agui           # Next.js → backend AG-UI endpoint (server-side)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000  # browser → backend REST API
FRONTEND_ORIGIN=http://localhost:3000          # backend CORS (backend/.env)
VOLTTI_DB_PATH=…                               # optional SQLite path override (backend)
```

## Docker

```bash
cp .env.example .env   # set model + key
docker compose up --build
```

Compose runs two services: `backend` (uv image, `:8000`) and `voltti` (the storefront, `:3000`, with `AGENT_URL` pointing at the backend container). Stop with `docker compose down`.

## Validation

Run before handing off changes:

```bash
# Storefront
npm run typecheck
npm run lint
npm run build            # also prerenders all category and product pages

# Backend (from backend/)
uv run pytest            # parity tests vs the TS domain logic + REST API tests
```

If you changed the TypeScript domain logic (`src/lib/services.ts`), regenerate the parity fixtures first:

```bash
npx tsx scripts/generate-parity-fixtures.ts && cd backend && uv run pytest
```

Manual smoke test:

1. Browse a category, apply a max-price filter, confirm the URL query updates.
2. Open a product page, add to cart, change quantity in the cart, proceed through the mock checkout to the confirmation screen — then check `/account`: the order must appear (it came back from the backend).
3. Select two PC parts for comparison (e.g. an Intel CPU and an AM5 board) and confirm the compatibility warning appears in the modal.
4. Open the assistant and ask for discounted phones under €500 — it should search, open the filtered listing, and render result cards in chat.
5. Ask it to add a product to the cart — an approval card must appear; nothing is added until you click.
6. As Aino: "Will an Intel Core i7-14700K work with my current setup?" — the agent must flag the AM5 board from order VLT-1002.

## Troubleshooting

- **Storefront loads, chat fails immediately** — the backend isn't running on `:8000`, or `AGENT_URL` points elsewhere. Check `curl http://localhost:8000/api/health`.
- **Chat connects but errors mid-response** — the provider key doesn't match the model (`AGENT_MODEL`/`COPILOTKIT_MODEL`), or the model name is invalid. Watch the backend logs.
- **Order history empty / "is the store backend running?"** — the REST API is unreachable from the browser; check `NEXT_PUBLIC_BACKEND_URL` and backend CORS (`FRONTEND_ORIGIN`).
- **Agent doesn't know what the user owns** — `/api/users/{persona}/agent-profile` must return the owned-hardware profile; confirm the backend seeded orders (`/api/users` shows per-persona order counts).
- **Cart looks empty on first paint** — cart state hydrates from localStorage after mount (`voltti.cart.v1`); this is expected for a frame.
- **Port 3000/8000 in use** — `npm run dev -- -p 3001` / `--port 8001` (then update `AGENT_URL`, `NEXT_PUBLIC_BACKEND_URL`, `FRONTEND_ORIGIN`).
- **Compatibility warning missing** — the parts involved need `compat` metadata in `data/catalog.json` (CPU/board need `socket`, GPU needs `gpuLengthMm`, etc.).
- **Python/TS behavior drift suspected** — run the parity suite: `cd backend && uv run pytest tests/test_parity.py -v`.
