# Agentic E-commerce POC

## Project Goal

Build a realistic but compact electronics storefront where users can shop through both the traditional UI and a CopilotKit-powered conversational layer. The POC focuses on catalog search, recommendations, shortlist/comparison, PC compatibility warnings, cart drafting, and mock checkout approval.

## Stack

- Next.js App Router
- React + TypeScript
- CopilotKit v2:
  - `@copilotkit/react-core/v2` for provider, sidebar, app context, frontend tools, and human-in-the-loop UI
  - `@copilotkit/runtime` and `@copilotkit/runtime/v2` for the runtime endpoint and BuiltInAgent
- Local deterministic catalog services in `src/lib`
- Progressive WebMCP-style adapter in `src/components/commerce-experience.tsx`

## Important Files

- `src/app/api/copilotkit/route.ts`: CopilotKit runtime endpoint and server-side catalog tools.
- `src/components/commerce-experience.tsx`: Main storefront UI, CopilotKit frontend tools, shared context, HITL cart approval, and WebMCP registration.
- `src/lib/catalog.ts`: Mock inventory data.
- `src/lib/services.ts`: Search, recommendation, compatibility, alternatives, and cart helpers.
- `src/lib/types.ts`: Domain types for catalog, cart, filters, and shared shopping state.
- `src/app/globals.css`: Application styling.
- `docs/`: Developer documentation for architecture, design, features, agent behavior, and operations.
- `README.md`: Top-level project overview and quick start.
- `Dockerfile` and `docker-compose.yml`: Containerized local/demo runtime.

## Agent Behavior Guidelines

- Keep the app functional and POC-sized. Prefer improving the existing catalog/services over introducing databases, auth, payments, or external commerce APIs.
- Use deterministic service functions for product search, recommendations, and compatibility logic. The LLM should explain and orchestrate, not invent catalog facts.
- Checkout must remain human-approved. Do not add any path that silently completes an order or payment.
- When adding agent capabilities, expose them through the same domain service layer used by the UI.
- Keep WebMCP support as progressive enhancement. Feature-detect browser APIs and never make core shopping depend on WebMCP.
- For PC compatibility, check concrete product metadata such as CPU socket, motherboard socket, memory type, GPU length, and PSU headroom before claiming a build works.
- If adding products, include realistic specs, stock state, tags, pricing, and compatibility metadata where relevant.

## Common Commands

```bash
npm install
npm run dev
npm run build
npm run typecheck
```

## Environment

Set one provider key before using the live CopilotKit agent:

```bash
OPENAI_API_KEY=...
```

Optional:

```bash
COPILOTKIT_MODEL=openai/gpt-4o-mini
COPILOTKIT_TELEMETRY_DISABLED=true
```

Without an API key, the storefront UI still works, but live chat runs will fail when the BuiltInAgent calls the model provider.

Use `docs/runbook.md` as the operational source of truth when changing setup, Docker, or model/provider behavior.
