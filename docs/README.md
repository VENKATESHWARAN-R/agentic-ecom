# SignalCart Developer Docs

This folder contains the working developer documentation for the SignalCart agentic ecommerce POC. The docs are written for future contributors and agents that need to understand how the app is shaped before changing behavior.

## Reading Order

1. [Architecture](architecture.md): System structure, data flow, and important modules.
2. [Design](design.md): UX goals, layout rules, visual language, and interaction principles.
3. [Features](features.md): Current product surface and expected user journeys.
4. [Agent Contract](agent-contract.md): CopilotKit tools, state, safety rules, and WebMCP enhancement notes.
5. [Runbook](runbook.md): Setup, env vars, model/provider selection, Docker, validation, and troubleshooting.

## Project Boundaries

SignalCart is intentionally a POC. It should stay focused on agentic discovery, product reasoning, compatibility checks, cart drafting, and human-approved checkout. Avoid adding real payments, real user accounts, live inventory integrations, or broad personalization until the agentic flows are validated.
