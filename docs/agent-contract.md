# Agent Contract

This document defines how the CopilotKit agent is expected to behave in the SignalCart POC.

## Core Principle

The agent orchestrates shopping. The domain services own product facts and deterministic decisions.

The agent should not invent products, prices, stock, compatibility, or checkout status. It should use tools and app context before making claims.

## Server Tools

Defined in `src/app/api/copilotkit/route.ts`.

### `searchCatalog`

Searches the local catalog. Use before recommending products.

Inputs:

- `query`
- `category`
- `maxPrice`
- `dealOnly`
- `inStockOnly`

### `getProductAlternatives`

Finds in-stock alternatives for an unavailable or unsuitable product.

Input:

- `productId`

### `checkCompatibility`

Checks selected PC components for compatibility warnings.

Input:

- `productIds`

### `recommendGamingSetup`

Returns a structured gaming setup recommendation from inventory.

Inputs:

- `budget`
- `games`
- `brandPreference`
- `includeMonitor`
- `preferLaptop`

## Frontend Tools

Defined in `src/components/commerce-experience.tsx`.

### `navigateToPage`

Moves the UI to a top-level page.

### `applyProductFilters`

Applies search/category/budget/deal filters in the UI.

### `highlightProducts`

Highlights products in the catalog grid.

### `openComparison`

Sets comparison candidates and returns compatibility results.

### `draftCart`

Prepares a cart draft and marks it as pending approval. It does not add items directly.

### `confirmCartDraft`

Human-in-the-loop tool that asks the user to approve adding items.

## Safety Rules

- Do not say an order is complete.
- Do not silently finalize checkout.
- Do not add a cart draft without explicit user approval.
- Do not claim a component build is compatible until `checkCompatibility` has been called.
- If a product is unavailable, suggest in-stock alternatives.
- If the user asks for an unsupported product, explain that it is outside current inventory and offer closest matches.

## Good Agent Behavior

For "I want a gaming PC around €1500 for Valorant and AAA games":

1. Ask clarifying questions only if needed.
2. Call `recommendGamingSetup`.
3. Highlight recommended products.
4. Explain tradeoffs and total price.
5. Offer to draft the cart.
6. Ask for confirmation before adding items.

For "I picked an Intel CPU and AM5 motherboard":

1. Call `checkCompatibility`.
2. Name the incompatible socket mismatch.
3. Suggest replacing either the CPU or the motherboard.

For "Any discounted phones under €500?":

1. Call `searchCatalog` with `category=phones`, `maxPrice=500`, and `dealOnly=true`.
2. Apply UI filters.
3. Highlight or summarize the best matching in-stock products.

## WebMCP Contract

WebMCP registration is a progressive enhancement. Tools must remain single-purpose and should call the same local services or UI handlers as the CopilotKit path.

Do not expose a browser tool that completes checkout.
