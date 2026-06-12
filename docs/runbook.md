# Runbook

This runbook covers setup, model/provider configuration, Docker, validation, and common troubleshooting.

## Prerequisites

- Node.js 22 recommended.
- npm.
- One model provider API key if you want live CopilotKit chat.
- Docker Desktop or Docker Engine if using Compose.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

### `COPILOTKIT_MODEL`

Controls which model the CopilotKit BuiltInAgent uses.

Examples:

```bash
COPILOTKIT_MODEL=openai/gpt-4o-mini
COPILOTKIT_MODEL=openai/gpt-4.1-mini
COPILOTKIT_MODEL=anthropic/claude-3.5-haiku
COPILOTKIT_MODEL=google/gemini-2.5-flash
```

### Provider Keys

Set the key that matches the provider prefix in `COPILOTKIT_MODEL`.

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
```

### Optional

```bash
COPILOTKIT_TELEMETRY_DISABLED=true
PORT=3000
```

## Provider Switching

To switch from OpenAI to Anthropic:

```bash
COPILOTKIT_MODEL=anthropic/claude-3.5-haiku
ANTHROPIC_API_KEY=...
npm run dev
```

To switch to Google:

```bash
COPILOTKIT_MODEL=google/gemini-2.5-flash
GOOGLE_API_KEY=...
npm run dev
```

If the model provider or model name is invalid, the app can still render, but CopilotKit chat requests will fail when the runtime calls the provider.

## Validation

Run these before handing off changes:

```bash
npm run lint
npm run typecheck
npm run build
```

Manual smoke test:

1. Open the storefront.
2. Click "Build gaming setup".
3. Confirm products become selected and the advisor panel updates.
4. Add a product to cart.
5. Open cart and continue to mock checkout.
6. Open the copilot and ask for discounted phones under €500.

## Docker Compose

Create `.env`:

```bash
cp .env.example .env
```

Edit `.env` with the provider key and model you want.

Run:

```bash
docker compose up --build
```

Open:

```text
http://localhost:3000
```

Stop:

```bash
docker compose down
```

## Docker Without `.env`

You can also pass variables from the shell:

```bash
COPILOTKIT_MODEL=openai/gpt-4o-mini OPENAI_API_KEY=... docker compose up --build
```

## Troubleshooting

### Storefront loads, chat fails

Check that the provider key matches `COPILOTKIT_MODEL`.

Examples:

- `openai/...` needs `OPENAI_API_KEY`.
- `anthropic/...` needs `ANTHROPIC_API_KEY`.
- `google/...` needs `GOOGLE_API_KEY`.

### Docker build is slow

The first build installs dependencies and compiles Next.js. Later builds should reuse Docker cache unless `package.json` or `package-lock.json` changes.

### Port 3000 is already in use

Local dev:

```bash
npm run dev -- -p 3001
```

Docker Compose:

Change the port mapping in `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"
```

### Compatibility warning missing

Make sure selected component products include compatibility metadata in `src/lib/catalog.ts`. CPU and motherboard products need socket fields.
