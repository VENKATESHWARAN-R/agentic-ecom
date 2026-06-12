# Agent Contract

How the Voltti shopping assistant is expected to behave, and the tool surface that enforces it.

## Capabilities at a Glance

A quick reference for what the agent can and cannot do.

| The assistant **can** | The assistant **cannot** |
|---|---|
| Search the catalog and present results as cards | Invent products, prices, stock levels, or specs |
| Open filtered listings, product pages, and top-level pages | Navigate outside the Voltti storefront |
| Highlight products and open the comparison modal | Mark products as compatible without calling `checkCompatibility` |
| Run compatibility checks — including against hardware you already own | Invent compatibility verdicts from model knowledge |
| Recommend custom PC builds and prebuilt gaming setups | State a build is compatible without calling the compatibility tool |
| Suggest in-stock alternatives for unavailable or over-budget items | Silently add items to the cart |
| **Propose** cart additions — via an approval card the user must click | Mutate the cart or place an order without a human button-click |
| **Propose** placing an order — via a confirmation card the user must click | Skip the HITL approval even if explicitly asked to |
| Prefill the checkout form with details given in chat | Invent delivery details or fill payment info without consent |
| Apply a saved address via `useSavedAddress` without reading it aloud | Show the saved address text in chat (city level only) |
| Answer order history and return questions for the signed-in user | Access order data for any other user or accept a userId from the model |
| Quote computed return deadlines from `getReturnInfo` | Compute return deadlines itself via date math |
| Adapt verbosity to user expertise (fast path vs guided path) | Bypass the HITL approvals regardless of user expertise |

## Core Principle

The LLM orchestrates and explains; the domain services own the facts. Every product claim — existence, price, stock, specs, compatibility — must come from a tool result, never from model knowledge.

## Server Tools

Defined in `src/app/api/copilotkit/route.ts`, executed in the runtime. All are deterministic wrappers over `src/lib/services.ts` and return compact `productSummary` shapes.

| Tool | Purpose |
|---|---|
| `searchCatalog` | Search by query/category/maxPrice/brands/dealsOnly/inStockOnly. Category `gaming` matches gaming-tagged products across categories. Must be called before discussing specific products. |
| `getProductDetails` | Full details for one product id: description, specs, highlights, compat metadata. |
| `getProductAlternatives` | In-stock alternatives for an out-of-stock, over-budget, or unsuitable product. |
| `checkCompatibility` | PC-part check: CPU socket vs motherboard, memory generation, GPU length vs case clearance, PSU headroom, stock. Optional `owned: { productId, orderNumber, orderedOn }[]` unions in parts the customer already owns so conflicts span across orders and are attributed to the purchase ("…from your order VLT-1002"). |
| `recommendPcBuild` | Custom part-picker: allocates a budget across CPU/board/RAM/GPU/storage/PSU/case, keeps the platform consistent, runs the compatibility check on the result. |
| `recommendGamingSetup` | Prebuilt advisor: desktop or gaming laptop within budget, optional monitor and peripherals, plus alternatives. |

## Frontend Tools

Defined in `src/components/copilot/shopping-assistant.tsx`, executed in the browser via the Next router and `useShop()`. They steer what the user sees but never mutate the cart. The order/return tools are **identity-scoped**: they read the active persona directly, so there is no `userId` parameter for the model to supply (see Safety Rules).

| Tool | Purpose |
|---|---|
| `browseCatalog` | Open a listing with filters applied (writes the `q`/`max`/`brands`/`deals`/`stock`/`sort` URL params). |
| `showProduct` | Open a product detail page. |
| `goToPage` | Navigate to home, deals, cart, or checkout. |
| `highlightProducts` | Visually highlight products in the current listing. |
| `openComparison` | Open the comparison modal for 2–4 products; returns the compatibility result. |
| `prefillCheckout` | Fill the checkout form, then open checkout. With `useSavedAddress: true` it applies the signed-in persona's saved address **without the address ever entering chat** (returns only "Saved address applied"). Otherwise uses only details the user explicitly gave; never invents. |
| `getMyOrders` | Paginated order summaries for the active persona (`{ limit?: 1–20 = 5, offset? }`) + `total`. Returns `{ signedIn: false }` for guests. Renders an order-list card. |
| `getReturnInfo` | Return status + **explicit deadline** for one order (`{ orderNumber }`). Deadlines are computed by `returnEligibility()`, never by the model. Renders an eligible/closed/in-transit badge card. |

## Human-in-the-Loop

`useHumanInTheLoop` tools are the **only** chat paths that mutate the cart or place an order, and both render an approval card that requires a button click:

- `proposeCartUpdate` — proposes items with a reason and total; the user clicks "Add to cart" or declines. The handler reports which items were added and which were unavailable. The card runs a **local compatibility safety net**: it re-checks the proposed items against the signed-in user's owned hardware and shows any attributed conflict inline, so the human sees it at approval time even if the model's prose missed it.
- `confirmOrder` — shows the cart, total, delivery summary, and a "Place order" button. If delivery details are incomplete it routes the user to the checkout form instead. The agent may only claim an order was placed when the tool returned `placed: true`.

Never add a tool that silently adds to cart, fills payment data, or completes checkout.

## Safety Rules

- No silent checkout: orders go through `confirmOrder`, cart changes through `proposeCartUpdate`.
- No invented catalog facts: search/details tools first, always.
- Compatibility claims require `checkCompatibility` — including before presenting parts as a working build. Warn clearly on mismatches (e.g. Intel CPU on an AM5 board) and suggest a compatible replacement.
- Out-of-stock or over-budget requests route through `getProductAlternatives`; say plainly that the item is unavailable.
- `prefillCheckout` uses only details the user explicitly provided, or the saved address via `useSavedAddress`.
- **Identity is never a model parameter.** `getMyOrders`/`getReturnInfo` read the active persona client-side; the model cannot request another user's data. Guests get `{ signedIn: false }` and are told to sign in.
- **The saved address never transits the model.** It is applied via `prefillCheckout(useSavedAddress)` and shown on-page only; chat references it no more specifically than city level.
- **Returns are computed, not reasoned.** Quote the deadline `getReturnInfo` returns verbatim; never do date math in the model.

## Generative UI Conventions

`useRenderTool` renderers in `shopping-assistant.tsx` turn server tool results into cards in chat: search result lists, alternatives, compatibility verdicts (check/warning icon plus warning list), PC builds, and gaming setups — each as compact product rows with prices and a total. The identity-scoped frontend tools render their own cards too: `getMyOrders` → an order-list card (number, status chip, date, items), `getReturnInfo` → a return card with an eligible/closed/in-transit badge and the explicit deadline. Notes:

- `useRenderTool` and frontend-tool `render` receive `result` as a **string**; parse it defensively (`safeParse`).
- Cards show product details, so chat text should stay short and not repeat spec lists.
- New server tools whose results benefit from visual presentation should get a renderer.

## Agent Context and Suggestions

`useAgentContext` shares **derived, bounded** state (never raw order history):

- `user` — `signedIn`, first name, persona label, `ordersTotal`, `hasSavedAddress`, `preferredPayment` (or `{ signedIn: false }`).
- `ownedHardware` — ≤6 derived entries (one per PC-part category, newest wins): id, category, socket, memory type, Wi-Fi, order number + date. This is what makes the agent *spontaneously* catch cross-order conflicts; it passes these ids to `checkCompatibility`. `[]` for guests/new users.
- `currentPath`, `cart` (lines with names/prices), `cartTotal`, `comparisonProductIds`, `checkoutForm.complete` (a boolean — **not** the PII fields), `lastOrderNumber`.

See the context-budget table in `AGENTS.md` for the rules. Suggestions (`useConfigureSuggestions`) are **persona-aware**: Aino sees returns/compat prompts, Sami sees the fast-path order prompt, guests/Elina keep the generic four.

## WebMCP Contract

`src/lib/webmcp.ts` exposes `search_catalog`, `open_page`, and `add_to_cart` to browser agents via `navigator.modelContext`, calling the same services and `useShop` handlers as the CopilotKit path. It must remain feature-detected and a no-op when unsupported, and must never expose a tool that completes checkout.
