# Layer Classification (tools · data · authorization)

Part of the effort in [security-principles.md](security-principles.md). It is the concrete inventory the **tool gateway** and **authorization layer** enforce: a risk tier for every tool, a trust label and sensitivity for every piece of data, and the access-mode + ownership model that decides who may do what. See [architecture.md](architecture.md) for how these land in the as-built system.

> **Implemented.** This classification is enforced in the as-built system; the *placement* and *controls* columns describe what runs today. See [security-implementation.md](security-implementation.md) for the per-layer flows.

## 1. Tool layer — risk tiers

Tiers follow guide §12, plus **T0 (UI-steering)** for our generative-UI actions that change only the visible view and touch no data or authority.

| Tier | Meaning | Baseline controls |
|---|---|---|
| **T0 · UI-steering** | Changes the browser view only (navigate, highlight, open a modal). No data, no authority. | Stays a frontend tool; no auth; rate-limit only. |
| **T1 · Read-only / public** | Reads public catalog data or runs deterministic recommendations. No identity. | Rate limits, output filtering. |
| **T2 · User-data** | Reads identity-scoped data. | Auth + ownership + field-filtering + audit. |
| **T3 · Write** | Mutates state. | Auth + authz + explicit confirmation + audit (+ rollback where possible). |
| **T4 · High-impact** | Irreversible / financial. | Step-up auth + human approval + strict policy + detailed audit + anomaly detection. |

### Classification of every tool

| Tool | Location (today → target) | Tier | Identity-scoped | Required controls |
|---|---|---|---|---|
| `browseCatalog` | frontend → frontend | T0 | no | rate-limit |
| `showProduct` | frontend → frontend | T0 | no | rate-limit |
| `goToPage` | frontend → frontend | T0 | no | rate-limit |
| `highlightProducts` | frontend → frontend | T0 | no | rate-limit |
| `openComparison` | frontend → frontend | T0 | no | rate-limit (returns a *computed* compat result, no data) |
| `searchCatalog` | backend → backend | T1 | no | result cap (≤8), output filter |
| `getProductDetails` | backend → backend | T1 | no | output filter |
| `getProductAlternatives` | backend → backend | T1 | no | output filter |
| `checkCompatibility` | backend → backend | T1 | no | `owned` refs validated against session, not trusted from the model (see §3) |
| `recommendPcBuild` | backend → backend | T1 | no | deterministic; output filter |
| `recommendGamingSetup` | backend → backend | T1 | no | deterministic; output filter |
| `getMyOrders` | **frontend → backend** | **T2** | **yes** | auth + ownership (`order.userId == session`); returns summaries only; paginated (≤20); audit |
| `getReturnInfo` | **frontend → backend** | **T2** | **yes** | auth + ownership; returns *computed* eligibility; audit |
| `prefillCheckout` | frontend → frontend | T3* | partial | writes the client checkout **draft** only (pre-transactional). `useSavedAddress` reads the session's saved address server-side and copies it into the draft **without it transiting the model** (P6) |
| `proposeCartUpdate` (HITL) | frontend → frontend | T3 | no | **human approval** (button click); client-side compat safety net; cart is pre-transactional client state |
| `confirmOrder` (HITL) | frontend → backend | T3 | **yes** | **human approval** + auth; identity from session (never body); places the order record; audit |

Notes:
- **T4 is empty today** — we have no refund, cancel, price-override, or address-change tool. Those are the high-impact tier; if/when added they require step-up + human approval. `confirmOrder` is our most consequential action, so it carries a **human-approval control (T4-grade) on a T3 action** as a deliberate conservative floor.
- **No general-purpose, DB, or shell tool exists or may be added** (P5). Every new tool declares a tier here before it ships.

## 2. Data layer — trust labels & field sensitivity

### Sources → trust label (guide §7–§8, §14)

| Source | Label | Treatment |
|---|---|---|
| `data/catalog.json` (61 products) | `trusted_catalog` | Curated seed; safe as reference. Public. |
| Orders & profiles in SQLite | `trusted_user_record` | Authoritative, but **access-controlled per owner** — trusted as *data*, never as instructions. |
| Return policy text, system prompt | `trusted_policy` | Curated; governs behaviour. |
| Chat message | `untrusted_user_input` | Intent only; never instructions that override policy. Prompt-Guard screened. |
| Browser-sent AG-UI context (cart, owned hardware) | `untrusted_client_hint` | **Re-derived/validated server-side from the session** before any security use (P4). |
| _(Future)_ reviews, uploads, web content | `untrusted_external` | None today. When added: source-labelled, summarised not raw, **no tool call may originate from it** (§14). |

### Field sensitivity — what may reach the model

| Class | Fields | Reaches model? | Lives where |
|---|---|---|---|
| Public | all `Product` fields; computed compat/eligibility; order `number`/`status`/dates/line-items/`total` | ✅ yes | catalog, tool results |
| Low-sensitivity user facts | persona first name, `personaLabel`, `ordersTotal`, `hasSavedAddress` (bool), `preferredPayment` | ✅ derived only | bounded context (P6) |
| **PII — never to the model** | `CheckoutDetails` / `savedAddress`: `fullName`, `email`, `address`, `postalCode`, full `city`; `Order.details` | ❌ never (city-level max in prose) | server + UI only; applied via `prefillCheckout(useSavedAddress)` |
| Secrets / internal | `ANTHROPIC_API_KEY`, future fraud scores / internal notes | ❌ never (model **or** user) | server env; logs store hashes/metadata (P6) |

> **Demo-crutch flagged:** `GET /api/users` currently returns **every persona's email** to build the switcher. In the target this becomes the mock-login (the BFF selects identity) — it is **not** a public list of users + PII. Fix belongs in Step 4.

## 3. Authorization layer — modes & ownership

### Ownership predicate
Any T2/T3/T4 access to user data must satisfy `resource.userId == session.identity`, evaluated in the tool gateway against the **BFF-asserted session** — never against a model- or browser-supplied `userId`. Orders, returns, and the saved address are gated by it.

### Access modes (guide §21, mapped to us)

| Mode | Identity | Allowed | Not allowed |
|---|---|---|---|
| **Public** (guest) | none | All T0 + T1 (search, details, alternatives, compatibility, PC build, gaming setup, browse, compare); general return *policy*; build a local cart | Any user's orders / returns / saved address; identity-bound order placement; seeing any PII |
| **Authenticated** | session | `getMyOrders`, `getReturnInfo` (ownership-checked); `prefillCheckout(useSavedAddress)`; `proposeCartUpdate` (confirmation); `confirmOrder` (human approval) | Acting on another user's resources; T4 actions |
| **Step-up** _(future)_ | session + re-confirm | change saved address, cancel order, change payment/account details | — without a fresh confirmation |
| **Human-approval** _(future)_ | session + human | refund, store credit, price override, manual discount | — without an operator approving the *action* (not just the text) |

### Mock session → identity (target)
The persona switcher becomes a **mock login**: selecting a persona establishes a server-side session at the BFF (httpOnly cookie), which resolves identity and signs the assertion the backend trusts. Issuance is mock; enforcement (ownership, modes) is real.

## How this is enforced (as built)

This classification is realized in the running system:
- The **tool gateway** ([policy.py](../backend/src/voltti_backend/agent/policy.py)) keys off the Tier column: T1 passes cheaply; T2 enforces auth+ownership+audit; T3 requires confirmation/approval. Agent tools declare their tier.
- **REST `/api/users/{id}/*` enforces `{id} == session`** ([routes.py](../backend/src/voltti_backend/api/routes.py) `owner_or_403`); `POST /api/orders` takes identity from the session, not the body.
- **`GET /api/users`** carries no PII — it's the mock-login surface.
- **`prefillCheckout(useSavedAddress)`** applies the address client-side; it never enters the model.
- The **field-sensitivity table** drives [output validation](../backend/src/voltti_backend/agent/output_validation.py) and log redaction.

## See also
- [security-principles.md](security-principles.md) — the principles these tiers enforce (P2, P4, P5, P6).
- [architecture.md](architecture.md) — where the tool gateway and authz layer live in the as-built system.
- [agent-contract.md](agent-contract.md) — the tool surface; the frontend→backend moves above land here at implementation.
