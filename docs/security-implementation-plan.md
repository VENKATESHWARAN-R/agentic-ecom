# Security Hardening — Implementation Plan & Status (Continuation Guide)

A self-contained handoff so a fresh session can resume and finish the security hardening. **Start here**, then read the governing docs. Everything lives on branch **`feat/security-hardening`**.

## 0. How to use this document
This is the *continuation* guide: what we planned, why, what's built, and exactly what's left and where. The **source-of-truth docs** (don't re-decide what they settle):

1. [security-principles.md](security-principles.md) — the constitution (P1–P9), risk class, charter. **Binding.**
2. [target-architecture.md](target-architecture.md) — the planned target topology + trust-boundary map.
3. [layer-classification.md](layer-classification.md) — tool risk tiers, data trust labels + the PII field table, the authz model.
4. [security-implementation.md](security-implementation.md) — the **as-built flows** (what/why/how, with diagrams), one section per finished slice.

Reading order for a cold start: **this doc → 1 → 2 → 3 → 4**.

## 1. The big picture (what & why)
- **Charter:** demo *surface* (fake UI/catalog/personas), **production-grade *depth*** (architecture, security, agentic orchestration are the real point). A reference implementation of secure agentic generative UI.
- **Ambition:** *real controls, mock credentials* — risk class **Medium**; implement the full medium-risk control set for real, using mock tokens (no real IdP/payments/OTP).
- **Approach:** principles-first. The 4-step ladder (principles → target architecture → layer classification → mechanisms) is done for steps 1–3; **mechanisms (step 4) are being implemented as 6 slices**:

| Slice | Principle(s) | What | Status |
|---|---|---|---|
| 1 — Identity & BFF session | P4 | Server-resolved identity; browser never calls backend directly | ✅ done (`a59a062`, `73cbcbf`) |
| 2 — Authz + tool gateway | P2/P5 | REST ownership (IDOR fix) + agent tool gateway, identity-scoped backend tools | ✅ done (`99325f9`, `af72c1e`) |
| 3 — Edge + limits | P7 | nginx single ingress + per-IP/per-identity rate limits + per-run token caps | ✅ done (`7bdcf49`) |
| 4 — Input safety | P3/P7 | Prompt-injection/jailbreak screen + abuse scoring | ✅ done (`f92f77c` + 4b) |
| 5 — Output validation | P6 | Leak/field-filter/unsafe-link checks on agent output | ⬜ not started |
| 6 — Observability | P7 | Logfire audit + the §19 metrics | ⬜ not started |

## 2. Environment & how to run
- **Branch:** `feat/security-hardening` (off `feat/agent-backend-extraction`; design docs committed at `f8299c4`).
- **Services / ports:** Next storefront `:3000` · agent backend `:8000` · **guard service `:8001`** (new) · nginx edge `:80` (compose only).
- **Run (local dev):** `./scripts/dev.sh` (backend + storefront). Backend alone: `uv --directory backend run uvicorn voltti_backend.main:app --port 8000`. Guard: `uv --directory guard run uvicorn voltti_guard.main:app --port 8001`. The nginx **edge runs only under `docker compose`** — local dev hits `:3000` directly.
- **Tests:** `uv --directory backend run pytest` (73) · `uv --directory guard run pytest` (3) · `npm run typecheck` · `npm run lint`. (Use `uv --directory <proj>` so pytest picks the right rootdir.)
- **Browser verification:** use the `preview_*` tools (preview_start `voltti-dev`, preview_eval/snapshot/network) — not curl — for anything UI-observable.
- **Env vars** (`.env` is gitignored; `.env.example` documents them):
  - `INTERNAL_JWT_SECRET` — shared BFF↔backend assertion secret (Slice 1).
  - `BACKEND_URL` (server-side BFF→backend), `AGENT_URL` (→ `/agui`).
  - `HF_TOKEN` — **set** (real value in `.env`), but the **Llama license was still *pending* approval** at handoff → the gated PG2 download 403s until approved.
  - `GUARD_MODEL_ID` (default `meta-llama/Llama-Prompt-Guard-2-22M`), `GUARD_THRESHOLD` (0.5), `GUARD_MAX_CHARS` (8000).
  - **Slice 4b will add:** `GUARD_URL` (e.g. `http://localhost:8001` / `http://guard:8001` in compose), `GUARD_ENABLED`, `GUARD_FAIL_OPEN`.

## 3. What's implemented (read [security-implementation.md](security-implementation.md) for the flows)
- **Slice 1 (P4):** Next.js **BFF owns a mock-auth session** (httpOnly signed cookie); it mints a short-lived signed **identity assertion** the backend verifies (`backend/.../security.py`). Browser→backend REST goes through `src/app/api/bff/[...path]/route.ts`; `src/lib/api.ts` is same-origin; identity comes from the session, not localStorage/body. *Verified in browser: login→assertion→identity; network shows only same-origin.*
- **Slice 2 (P2/P5):** `owner_or_403` on every `/api/users/{id}/*` route (401/403); orders attributed to the session; `GET /api/users` de-PII'd. The **agent tool gateway** (`backend/.../agent/policy.py`) tiers + audits tool calls; `getMyOrders`/`getReturnInfo` are now **backend `@agent.tool`s scoped to `deps.identity`** (the CopilotKit route attaches the assertion; `/agui` verifies it into `AgentDeps.identity`). *Verified live: as Aino, chat `getMyOrders` returns her orders; cross-user REST → 403.*
- **Slice 3 (P7):** `deploy/nginx/voltti.conf` = single ingress (per-IP rate limits, 256 KB body cap, timeouts, method allow-list, TLS-ready); compose publishes only the edge (backend + app go off the host). Backend `ratelimit.py` = per-identity sliding-window limit on `/agui`; per-run `UsageLimits(request_limit, tool_calls_limit, total_tokens_limit)`. *Verified: nginx in Docker → 200/429/405; limiter unit-tested.*
- **Slice 4a (P3/P7):** **`guard/`** = a **separate** uv-managed FastAPI service (heavy torch dep isolated, non-mandatory, independently upgradeable). `POST /classify` loads a Prompt Guard DeBERTa classifier once (lifespan + warmup), **caps + windows the message to ≤512 tokens** (tokenizer overflow, stride 50), scores each window, **max-pools** the malicious probability, runs in a threadpool. *Verified against an ungated stand-in: benign→~0.00, jailbreak/injection/tool-forcing→~1.00, >512-tok messages window correctly.*

---

## 4. What's left — detailed work

### Slice 4b — wire the guard into the chat gateway + abuse scoring ✅ DONE
The classifier is now called before every agent run. As-built flow + diagram: [security-implementation.md](security-implementation.md) "Slice 4 · Input safety". Summary of what landed:
- **Guard client** `backend/.../guard_client.py` — `httpx` POST to `GUARD_URL/classify`, short timeout, `GUARD_ENABLED`-gated, **fails open** by default (`GUARD_FAIL_OPEN`).
- **The screen** in `main.py` `/agui` — extracts the latest user message (`body["messages"]`, last `role == "user"`, string `content`), screens it before dispatch; a `blocked` verdict returns a refusal as a **valid AG-UI SSE stream** (built from `ag_ui.core` events + `EventEncoder` — renders as a normal chat message, not a 4xx) and the agent never runs.
- **Abuse scoring** `backend/.../abuse.py` — decaying per-identity weighted score (guard block +3, unauthorized-tool attempt +2 via a hook in `policy.py`); levels normal → restricted (≥3) → blocked (≥6), 10-min window; a *blocked* caller is paused before screening.
- **Config/Docker** — `GUARD_URL/ENABLED/FAIL_OPEN/TIMEOUT_SECONDS` in `config.py` + `.env.example`; new `guard/Dockerfile` (+ `.dockerignore`) that **bakes the model weights** via an `HF_TOKEN` build secret and runs offline (`HF_HUB_OFFLINE=1`); `guard` service added to `docker-compose.yml` (internal `expose: 8001`, backend reaches `http://guard:8001`).
- **Tests** — `backend/tests/test_guard_screen.py` (blocked→refusal+agent-not-run, allowed→dispatch, guard-down→fail-open/closed) and `test_abuse.py` (scoring/decay/levels/isolation).

**Tuning note (carry-over):** with the PG2 license now cleared, PG2 is the default; tune `GUARD_THRESHOLD` against it (the ungated stand-in false-positived on long *repetitive* benign text). Optional: export PG2 to **ONNX + INT8** (~70 MB, faster) and drop torch from the guard image.

### Slice 5 — output validation (P6)
**Why:** the model's output is the last trust boundary — it can leak PII/secrets/the system prompt, hallucinate policy, or emit unsafe links. Validate before it reaches the user.

**Where & what:**
- A backend **output-validation layer** between the agent and the response. Checks (guide §16, [layer-classification.md](layer-classification.md) §2 field table): PII / secret / internal-prompt leakage, unsafe/external links, and **field-filter tool results to what was asked** (no full-record dumps).
- **Note our current exposure is low** by construction: tool results are already bounded (`productSummary`, order summaries, computed eligibility — no address/email), and the saved address never transits the model. So Slice 5 is mostly *guardrails to keep it that way* + link/secret/prompt-leak scanning of free text.
- **Streaming caveat** (in [target-architecture.md](target-architecture.md)): AG-UI streams over SSE, so full free-text validation mid-stream is limited. Validate **structured tool results fully**; do best-effort checks on text; prefer structured responses for anything high-risk. **Investigate the hook point**: Pydantic AI `@agent.output_validator` / result hooks for structured output, and/or a post-stream check. Document what you choose.
- **Verify:** a tool result with extra fields gets filtered; a crafted response containing a fake external link / a secret-looking string is flagged. Add tests.

### Slice 6 — observability (P7)
**Why:** "if you can't observe the agent, you can't safely operate it." Also closes a known gap — the tool-gateway audit logger (`policy.py` `logger.info`) is **not surfaced** by uvicorn's default logging today.

**Where & what:**
- Use the **`logfire-instrumentation`** skill. Wire **Logfire** into the backend (and the guard service). Pydantic AI + FastAPI have first-class Logfire integration.
- **Audit every decision:** tool-gateway authorizations (`policy.py`), authz 401/403 (`owner_or_403`), rate-limit 429s (`ratelimit.py`), guard verdicts (4b), per-run token usage. **Logs store hashes/metadata, not raw prompts/PII** (P6).
- **Metrics (guide §19):** Prompt Guard hit rate, unauthorized-tool attempts, tool calls/session, token spend/session, refusal rate, etc.
- **Verify:** trigger a tool call, a 403, a 429, and a guard block → confirm each appears as a structured Logfire event/metric with no raw PII.

## 5. Known carry-overs / tech debt (cross-slice)
- **Persona PII in the client bundle** — `src/lib/users.ts` ships personas incl. `savedAddress`. Move server-side (it's a demo crutch; identity-of-record is already the session). Relates to the context-builder in [target-architecture.md](target-architecture.md).
- **Owned-hardware agent context is still browser-supplied** (`useAgentContext` → `body.context`) — an *untrusted hint*. Target: re-derive it server-side from the session in `/agui` (the "context builder" layer). The backend already has `agent-profile`; reuse it keyed by `deps.identity`.
- **nginx TLS** — the `:443` block is configured but commented; enable it + a (self-signed for demo) cert.
- **Server-side conversation history** — CopilotKit sends client history; we derive nothing security-relevant from it, but full server-side thread persistence is a recognized stretch goal.
- **Step-up auth & high-impact (T4) tools** — none exist today; if refund/cancel/address-change tools are added, they need step-up + human approval (layer-classification §3).
- **Guard:** threshold tuning for PG2; ONNX/INT8 size optimization; bake weights for offline Docker.

## 6. Doc maintenance (per the [docs standard](security-implementation.md))
When each remaining slice lands, **add its as-built section to [security-implementation.md](security-implementation.md)** (plain-language flow + diagram + "see it working") and flip its row in §1 here. Keep `AGENTS.md` and [agent-contract.md](agent-contract.md) tool tables accurate. Mark the slice's task complete.

## 7. Commit history (this branch, newest first)
```
f92f77c  Slice 4a — standalone input-safety (Prompt Guard) service
7bdcf49  Slice 3   — nginx edge + chat-gateway rate limits
af72c1e  Slice 2b  — agent tool gateway + identity-scoped backend tools
99325f9  Slice 2a  — REST ownership (IDOR fix)
723bc9b  Slice 2a docs
73cbcbf  Slice 1b  — storefront cutover to the BFF session
a59a062  Slice 1a  — BFF↔backend identity assertion channel
f8299c4  design spec (principles, target arch, layer classification)
```
