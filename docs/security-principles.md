# Security & Design Principles

The governing constitution for Voltti. **Read this before any change-related decision or code change**, and make sure your change complies — or states the explicit trade-off it makes. It outranks convenience: a change that violates a binding principle is wrong even if it works.

Adapted from [research/Guardrail Design Principles for Agentic LLM Applications.pdf](research/Guardrail%20Design%20Principles%20for%20Agentic%20LLM%20Applications.pdf) and a reflection on this codebase. Voltti is a POC, but it handles order data, addresses, and a tool-using agent — so it is designed to a **production-grade security shape**: real controls, mock credentials (see _Ambition_).

## How to use this document

- **Binding (P1–P7):** non-negotiable. If a violation is genuinely unavoidable, call it out and justify it explicitly in review — never slip it in silently.
- **Aspirational (P8–P9):** the direction we want; adopt when practical. Not a blocker for the POC.
- **Cite your principle.** Every change notes, in its commit/PR, the principle it upholds or the trade-off it makes. A new tool must declare a risk tier (P5) or it does not ship.
- **Status tags** (in _Where we stand today_): `live` = enforced in code · `partial` = partly there · `planned` = a known gap on the roadmap.

## Ambition: real controls, mock credentials

**The depth of this project is its architecture, not its surface.** The UI, catalog, and customers are demo/fake; the security design, architecture decisions, and agentic orchestration are real, production-grade work — a reference implementation of secure agentic generative UI. Everything below holds to that bar.

**Risk class: Medium** (§4 of the guide). The agent reads user-specific data (orders, owned hardware, saved address) but performs no autonomous high-impact action — every mutation is human-approved. We implement the **full medium-risk control set for real** — authentication, per-user authorization, session isolation, PII discipline, audit logging — using **mock tokens** instead of a real identity provider. We simulate honestly: the control is real and server-enforced; only credential issuance is fake. We do **not** build real payments, OTP/passkey/SSO, or external commerce integrations.

## Prime directive

> A safe agentic system is not one where the model never errs. It is one where the model can be wrong, the user can be malicious, and content can be poisoned — and still nothing leaks, no unauthorized action runs, and no unacceptable damage occurs.

## Foundations

Guardrails are a **layered control system**, not a single feature. Each layer stops a different class of failure, and no single layer is enough:

```
external input → edge protection → chat gateway → input safety
   → context / retrieval control → agent reasoning → tool authorization
   → output validation → monitoring & response
```

**Trust boundaries we recognize** — every one needs a control:

| Boundary | Why it matters |
|---|---|
| Browser → backend | The browser is untrusted; users can forge requests, identity, and roles. |
| User input → agent | Prompts may carry jailbreaks or injection. |
| Retrieved / 3rd-party content → agent | _(Future)_ reviews, uploads, or web content may carry indirect injection. |
| Agent → tools | The model may request unsafe or unauthorized actions. |
| Tool output → agent | Responses may contain sensitive or untrusted data. |
| Agent output → user | The model may leak data, hallucinate policy, or emit unsafe links. |

_Mapping these onto our two-service topology — the target architecture diagram — is **Step 2**. This document defines the principles those layers must enforce._

## Part I — Runtime principles (binding)

### P1 · Determinism boundary
Anything with one correct answer — price, stock, totals, return deadlines, compatibility, order facts — is computed by backend code. The LLM orchestrates and explains; it is never the source of truth.
**Binds us:** no business fact originates in the model; each traces to a domain function. Deadlines are quoted verbatim from `return_eligibility()`, never reasoned.

### P2 · The LLM authorizes nothing
A deterministic policy layer decides whether any consequential action is allowed; the model may only _propose_. Default-deny, **fail-closed** — a check that errors or is uncertain denies.
**Binds us:** every tool call passes a policy check (identity, ownership, risk tier, confirmation/approval state) before executing. Cart and order mutations stay human-approved. This becomes a real tool gateway, not a convention.

### P3 · Guardrails are structural, not promptual
A safety property is enforced by code, never by asking the model nicely. The system prompt may _reinforce_ a rule, never _be_ the rule.
**Binds us:** the compatibility safety net at the approval card is the template — every guardrail must survive the model ignoring its instructions.

### P4 · Untrusted by default; identity is server-resolved
User input, browser-supplied context, and any future retrieved content are _data_, never instructions. Identity, roles, and permissions come from a **server-side session**, never from the browser or the model.
**Binds us:** retire browser-asserted identity for a backend-resolved session (mock token now). No `userId` in a request body as the identity of record. Browser-supplied agent context is an untrusted _hint_ — anything security-relevant is re-derived server-side from the session.

### P5 · Least privilege & risk-classified tools
Every tool is small, single-purpose, typed, and tagged with a risk tier (read-only / user-data / write / high-impact); controls scale with the tier.
**Binds us:** no general-purpose, database, or shell tool for the agent. A new tool declares a tier to ship; user-data tools require auth + ownership + audit; write/high-impact tools require confirmation or approval.

### P6 · Data minimization & privacy
The model sees the least data that makes it useful — derived, bounded, paginated. No raw PII, secrets, or raw history in context; secrets stay server-side; memory is user-scoped, never used for authorization, and expirable.
**Binds us:** the context budget stays a hard contract; the saved address never transits the model; tool outputs are field-filtered to what was asked (no full-record dumps); logs store hashes/metadata, not raw prompts or PII.

### P7 · Observability, limits & containment
The system is rate-limited, cost-bounded, audited, and abuse-scored; when risk rises, capability drops _before_ anything else.
**Binds us:** limits by IP / session / turn / token / action; an audit record for every tool and policy decision; progressive enforcement (normal → reduced → read-only → blocked); the incident reflex is "reduce capability first."

## Part II — Practice principles (aspirational)

### P8 · Prompt & policy are governed config
The system prompt, tool definitions, and policy rules are versioned, reviewed, and change-controlled like code, and the active version is logged with each request.

### P9 · Adversarial testing is continuous; docs are law
We test guardrails the way we test parity — an injection/abuse/authz eval suite that runs in CI. This constitution governs; every change cites the principle it serves or the trade-off it makes.

## Where we stand today

An honest map of each principle against the current code, and the gap the roadmap closes.

| Principle | Status | Today / gap |
|---|---|---|
| P1 Determinism boundary | `live` | Tools are deterministic domain wrappers; returns and compatibility computed, never reasoned. |
| P2 LLM authorizes nothing | `partial` | Human-in-the-loop gates every mutation, but there is **no deterministic policy layer / deny-by-default tool gateway** yet. |
| P3 Structural guardrails | `live` | The compat safety net at the approval card is code, not prompt; HITL is the only mutation path. |
| P4 Server-resolved identity | `planned` | **Identity is browser-trusted today** — the persona is a localStorage value passed as a REST path id ([api/routes.py](../backend/src/voltti_backend/api/routes.py)); browser context is injected into the prompt ([main.py](../backend/src/voltti_backend/main.py)). The single biggest gap. |
| P5 Least privilege & tiers | `partial` | All agent tools are read-only and narrow, but tiers are **not yet declared or enforced**. |
| P6 Data minimization | `live` | Context budget enforced; saved address never transits the model. Tool-output field-filtering and log redaction **not yet formalized**. |
| P7 Observability & limits | `planned` | Only `request_limit=10` exists. **No rate limits, audit log, or abuse scoring** yet. |
| P8 Governed config | `aspirational` | The prompt is hot-editable markdown; not versioned/reviewed yet. |
| P9 Continuous red-teaming | `aspirational` | A parity suite exists; **no guardrail/red-team eval suite** yet. |

## Roadmap

This constitution is **Step 1** of a four-step effort. Mechanisms come last — each becomes "principle _X_ enforced at boundary _Y_," never a control adopted for its own sake.

1. **Principles & philosophy** — _this document._
2. **Layered target architecture & trust boundaries** — _done → [target-architecture.md](target-architecture.md)._ The diagram for our two services and where each control plugs in.
3. **Layer classification** — _done → [layer-classification.md](layer-classification.md)._ Risk-rank every tool, label every data source, define the mock-but-real-shaped authz model.
4. **Mechanisms** — edge/nginx, input safety (Prompt/LLM Guard), the Pydantic AI tool gateway/policy layer, rate limits, output validation, audit logging.

## See also

- [architecture.md](architecture.md) — the two services, data ownership, and the customer-memory / identity decisions (instances of P1, P4, P6).
- [agent-contract.md](agent-contract.md) — the tool surface, Safety Rules, and HITL approvals (instances of P1–P5).
- [research/Guardrail Design Principles for Agentic LLM Applications.pdf](research/Guardrail%20Design%20Principles%20for%20Agentic%20LLM%20Applications.pdf) — the source guide this is adapted from.
