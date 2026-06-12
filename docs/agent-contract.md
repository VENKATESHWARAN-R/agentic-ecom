# Agent Contract

How the Voltti shopping assistant is expected to behave, and the tool surface that enforces it.

## Core Principle

The LLM orchestrates and explains; the domain services own the facts. Every product claim — existence, price, stock, specs, compatibility — must come from a tool result, never from model knowledge.

## Server Tools

Defined in `src/app/api/copilotkit/route.ts`, executed in the runtime. All are deterministic wrappers over `src/lib/services.ts` and return compact `productSummary` shapes.

| Tool | Purpose |
|---|---|
| `searchCatalog` | Search by query/category/maxPrice/brands/dealsOnly/inStockOnly. Category `gaming` matches gaming-tagged products across categories. Must be called before discussing specific products. |
| `getProductDetails` | Full details for one product id: description, specs, highlights, compat metadata. |
| `getProductAlternatives` | In-stock alternatives for an out-of-stock, over-budget, or unsuitable product. |
| `checkCompatibility` | PC-part check: CPU socket vs motherboard, memory generation, GPU length vs case clearance, PSU headroom, stock. |
| `recommendPcBuild` | Custom part-picker: allocates a budget across CPU/board/RAM/GPU/storage/PSU/case, keeps the platform consistent, runs the compatibility check on the result. |
| `recommendGamingSetup` | Prebuilt advisor: desktop or gaming laptop within budget, optional monitor and peripherals, plus alternatives. |

## Frontend Tools

Defined in `src/components/copilot/shopping-assistant.tsx`, executed in the browser via the Next router and `useShop()`. They steer what the user sees but never mutate the cart.

| Tool | Purpose |
|---|---|
| `browseCatalog` | Open a listing with filters applied (writes the `q`/`max`/`brands`/`deals`/`stock`/`sort` URL params). |
| `showProduct` | Open a product detail page. |
| `goToPage` | Navigate to home, deals, cart, or checkout. |
| `highlightProducts` | Visually highlight products in the current listing. |
| `openComparison` | Open the comparison modal for 2–4 products; returns the compatibility result. |
| `prefillCheckout` | Fill the checkout form with details the user gave in chat, then open checkout. Never invents details. |

## Human-in-the-Loop

`useHumanInTheLoop` tools are the **only** chat paths that mutate the cart or place an order, and both render an approval card that requires a button click:

- `proposeCartUpdate` — proposes items with a reason and total; the user clicks "Add to cart" or declines. The handler reports which items were added and which were unavailable.
- `confirmOrder` — shows the cart, total, delivery summary, and a "Place order" button. If delivery details are incomplete it routes the user to the checkout form instead. The agent may only claim an order was placed when the tool returned `placed: true`.

Never add a tool that silently adds to cart, fills payment data, or completes checkout.

## Safety Rules

- No silent checkout: orders go through `confirmOrder`, cart changes through `proposeCartUpdate`.
- No invented catalog facts: search/details tools first, always.
- Compatibility claims require `checkCompatibility` — including before presenting parts as a working build. Warn clearly on mismatches (e.g. Intel CPU on an AM5 board) and suggest a compatible replacement.
- Out-of-stock or over-budget requests route through `getProductAlternatives`; say plainly that the item is unavailable.
- `prefillCheckout` uses only details the user explicitly provided.

## Generative UI Conventions

`useRenderTool` renderers in `shopping-assistant.tsx` turn server tool results into cards in chat: search result lists, alternatives, compatibility verdicts (check/warning icon plus warning list), PC builds, and gaming setups — each as compact product rows with prices and a total. Notes:

- `useRenderTool` receives `result` as a **string**; parse it defensively (`safeParse`).
- Cards show product details, so chat text should stay short and not repeat spec lists.
- New server tools whose results benefit from visual presentation should get a renderer.

## Agent Context and Suggestions

`useAgentContext` shares live storefront state: current path, cart lines with names and prices, cart total, comparison ids, checkout-form fields and completeness, and the last order number. The agent should consult this before, for example, calling `confirmOrder`. Static suggestions (`useConfigureSuggestions`) appear before the first message: build a gaming PC, phone deals, check my build, headphones advice.

## WebMCP Contract

`src/lib/webmcp.ts` exposes `search_catalog`, `open_page`, and `add_to_cart` to browser agents via `navigator.modelContext`, calling the same services and `useShop` handlers as the CopilotKit path. It must remain feature-detected and a no-op when unsupported, and must never expose a tool that completes checkout.
