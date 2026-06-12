# SignalCart Agentic Commerce POC

SignalCart is a CopilotKit-powered ecommerce proof of concept for electronics shopping. It combines a traditional storefront with an agentic shopping copilot that can search the catalog, suggest products, draft carts, and flag PC compatibility issues before checkout.

## What This Demonstrates

- A realistic electronics storefront with phones, gaming devices, PC components, offers, cart, and mock checkout.
- CopilotKit runtime with a BuiltInAgent and deterministic server-side catalog tools.
- Frontend tools that let the agent steer page navigation, filters, comparisons, and cart drafts.
- Human-in-the-loop confirmation for cart updates and checkout-style actions.
- Progressive WebMCP-style browser tool registration behind feature detection.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To use the live CopilotKit agent, set a provider key in `.env` and choose a model:

```bash
COPILOTKIT_MODEL=openai/gpt-4o-mini
OPENAI_API_KEY=...
```

Other examples:

```bash
COPILOTKIT_MODEL=anthropic/claude-3.5-haiku
ANTHROPIC_API_KEY=...
```

```bash
COPILOTKIT_MODEL=google/gemini-2.5-flash
GOOGLE_API_KEY=...
```

## Docker

```bash
cp .env.example .env
docker compose up --build
```

## Documentation

Start with [docs/README.md](docs/README.md).

- [Architecture](docs/architecture.md)
- [Design](docs/design.md)
- [Features](docs/features.md)
- [Agent Contract](docs/agent-contract.md)
- [Runbook](docs/runbook.md)

## Useful Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run start
```
