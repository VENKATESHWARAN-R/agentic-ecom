# Voltti Agent Backend

The agentic system for the Voltti storefront, extracted into its own uv-managed Python service so prompts, tools, and the model can be managed without touching the application code.

What lives here:

- **The shopping agent** — [src/voltti_backend/agent/agent.py](src/voltti_backend/agent/agent.py): a Pydantic AI agent exposed over the [AG-UI protocol](https://docs.ag-ui.com) at `POST /agui`, consumed by the storefront's CopilotKit runtime via `HttpAgent`.
- **The system prompt** — [src/voltti_backend/agent/prompt.md](src/voltti_backend/agent/prompt.md). Edit it freely; the server reloads it on restart.
- **The domain layer** — [src/voltti_backend/domain/](src/voltti_backend/domain/): deterministic catalog search, PC-part compatibility, build recommenders, and order logic. A behavior-exact port of the storefront's original TypeScript, enforced by parity fixtures.
- **The REST API** — [src/voltti_backend/api/routes.py](src/voltti_backend/api/routes.py): products, personas, order history/returns, the agent's owned-hardware profile, and order placement.
- **SQLite** — `voltti.db`, seeded on startup from the shared [../data/](../data/) JSON (catalog + personas) and the demo order specs (fresh relative dates each start; user-placed orders persist).

## Run

```bash
uv sync
cp .env.example .env   # optional — the repo-root .env is read too
uv run uvicorn voltti_backend.main:app --reload --port 8000
```

## Test

```bash
uv run pytest                          # everything
uv run pytest tests/test_parity.py    # TS↔Python behavior parity only
```

The parity fixtures are generated from the TypeScript implementation:

```bash
cd .. && npx tsx scripts/generate-parity-fixtures.ts
```

Regenerate them whenever `src/lib/services.ts` changes, then re-run pytest.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `AGENT_MODEL` | `COPILOTKIT_MODEL` → `anthropic:claude-sonnet-4-6` | Agent model, Pydantic AI `provider:model` format |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_API_KEY` | — | Key matching the provider |
| `VOLTTI_DB_PATH` | `backend/voltti.db` | SQLite location |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | CORS origin for the storefront |

Identity note: persona ids in REST paths are trusted as-is — this is a demo with no auth. The invariant that carries to production is that identity is resolved by the calling infrastructure (here: the storefront's session state), never supplied by the model.
