# Voltti Developer Docs

Working documentation for the Voltti agentic e-commerce POC, written for contributors and agents who need to understand the app before changing it. `AGENTS.md` at the repo root is the authoritative short summary; these docs add depth.

## Reading Order

0. [Security & Design Principles](security-principles.md): **the governing constitution — read before any change-related decision or code change.** Every other doc and change defers to it.
1. [Architecture](architecture.md): domain layer, the two access paths (UI and agent), data flow, and state model.
   - [Target Architecture](target-architecture.md): the ratified security/architecture target (Phase 2) — BFF session, tool gateway, edge, output validation. Not yet implemented.
   - [Layer Classification](layer-classification.md): per-tool risk tiers, data trust labels, and the authz/ownership model (Phase 3). Design only.
   - [Security Implementation](security-implementation.md): how the security layers actually work today — as-built flows, what/why/how, updated per slice.
   - [Security Implementation Plan](security-implementation-plan.md): **continuation guide** — status of all 6 slices, and the detailed remaining work (where & why). Start here to resume the hardening.
2. [Agent Contract](agent-contract.md): the tool surface, safety rules, and generative UI conventions.
3. [Features](features.md): current feature set and the signature user journeys.
4. [Design](design.md): visual language, layout zones, and interaction rules.
5. [Runbook](runbook.md): setup, env vars, model selection, Docker, and validation.

## Project Boundaries

Voltti is a POC at its **surface** and production-grade in its **depth**. The UI, catalog, and customers are fake; the **architecture, security design, and agentic orchestration are real work — the reason the project exists** (a reference implementation of secure agentic generative UI). Keep the *surface* small; build the *depth* for real:

- No real payment rail, identity provider, or live inventory — but a **real-shaped session, per-user authorization, tool gateway, limits, and audit**, built with mock credentials (see [Security & Design Principles](security-principles.md)). The only database is the backend's SQLite, re-seeded on startup.
- The catalog stays a static seed (`data/catalog.json`, shared by both services); the domain layer stays deterministic and offline.
- Cart persistence stays in localStorage; orders are mock but owned by the backend DB.
- WebMCP stays a feature-detected enhancement — core shopping must never depend on it.
