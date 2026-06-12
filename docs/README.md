# Voltti Developer Docs

Working documentation for the Voltti agentic e-commerce POC, written for contributors and agents who need to understand the app before changing it. `AGENTS.md` at the repo root is the authoritative short summary; these docs add depth.

## Reading Order

1. [Architecture](architecture.md): domain layer, the two access paths (UI and agent), data flow, and state model.
2. [Agent Contract](agent-contract.md): the tool surface, safety rules, and generative UI conventions.
3. [Features](features.md): current feature set and the signature user journeys.
4. [Design](design.md): visual language, layout zones, and interaction rules.
5. [Runbook](runbook.md): setup, env vars, model selection, Docker, and validation.

## Project Boundaries

Voltti is intentionally a POC. It exists to demonstrate agentic discovery, grounded product reasoning, compatibility checking, and human-approved cart/checkout flows. Keep it that size:

- No real auth, real payments, or live inventory integrations. The only database is the backend's SQLite, re-seeded on startup.
- The catalog stays a static seed (`data/catalog.json`, shared by both services); the domain layer stays deterministic and offline.
- Cart persistence stays in localStorage; orders are mock but owned by the backend DB.
- WebMCP stays a feature-detected enhancement — core shopping must never depend on it.
