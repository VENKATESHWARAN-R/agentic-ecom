# Features

The current POC feature set and the user journeys it is built to demo.

## Storefront

- **Home** (`/`): hero, category tiles, top deals, featured products.
- **Category pages** (`/c/[slug]`): phones, laptops, desktops, components, monitors, audio, accessories, smart-home. Each has a filter sidebar (max price, in-stock only, on-sale only, brands) and a sort select (relevance, price asc/desc, rating). Filters live in the URL (`q`, `max`, `brands`, `deals`, `stock`, `sort`), so the agent and the user produce the same state.
- **Deals** (`/deals`): everything with an `originalPrice` discount, with the same filter sidebar.
- **Search** (`/search?q=`): free-text search from the header, over names, brands, tags, blurbs, and specs.
- **Product detail** (`/product/[id]`): breadcrumbs, buy box with quantity stepper and stock state, highlights, spec table, and an alternatives rail ("Similar products", or "In stock alternatives" when the item is out of stock).
- **Comparison**: a floating tray appears while 2–4 products are selected; the modal shows a side-by-side spec table and, when PC parts are involved, an automatic compatibility notice.
- **Cart** (`/cart`): quantity steppers, line removal, summary panel. Persisted in localStorage.
- **Checkout** (`/checkout`): delivery form, mock payment method choice (card / invoice / financing), order summary, and an order-confirmation screen with a fake order number. Nothing is charged.

## Catalog

~59 realistic products across 8 categories, including deals, two out-of-stock demo items (`galaxy-s25-ultra`, `rtx-5070`) that power the alternatives flow, and PC-part compatibility metadata (socket, memory type, power draw, PSU wattage, GPU length, case clearance) that powers the warnings demo.

## Agentic Shopping

The sidebar assistant can:

- Search the catalog and present results as cards in chat.
- Open filtered listings, product pages, and top-level pages; highlight products in view.
- Compare products and report PC-part compatibility verdicts.
- Recommend a custom PC build (`recommendPcBuild`) or a prebuilt gaming setup (`recommendGamingSetup`) for a budget.
- Suggest in-stock alternatives for unavailable or over-budget items.
- Propose cart additions and place orders — only via approval cards the user must click.
- Prefill the checkout form with details the user gave in chat.

## Signature Journeys

1. **Deal hunt** — "Any discounted phones under €500?" → catalog search → the listing opens with filters applied → best matches highlighted.
2. **Incompatible parts** — user picks an Intel CPU and an AM5 motherboard → `checkCompatibility` names the socket mismatch → the agent suggests a compatible replacement.
3. **Out of stock** — "I want the RTX 5070" → the agent says it's unavailable and offers in-stock alternatives at similar prices.
4. **PC build** — "Build me a gaming PC for €1500" → one or two clarifying questions → a compatibility-checked part list rendered as a card, with tradeoffs.
5. **Chat-driven checkout** — the agent proposes items → user approves → user gives delivery details → `prefillCheckout` → `confirmOrder` approval card → order confirmation page.

## WebMCP Enhancement

When `navigator.modelContext` exists (experimental browser API), the app registers `search_catalog`, `open_page`, and `add_to_cart` so browser agents can discover structured capabilities. In all other browsers this is a no-op; nothing in the app depends on it, and checkout is never exposed this way.
