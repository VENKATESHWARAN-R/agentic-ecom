# Design

Voltti should feel like a real Nordic electronics retailer, not a chatbot demo with a storefront bolted on. The store is the first-class experience; the assistant is a tool inside it.

## Visual Language

All styling is plain CSS in `src/app/globals.css` (no Tailwind). Theme tokens are defined in `:root`:

- **Base**: warm paper page (`--bg`), white panels (`--surface`), dark ink text (`--ink`), muted secondary text (`--muted`), warm-gray borders (`--line`).
- **Brand**: deep Nordic navy (`--brand`, `--brand-dark`, `--brand-soft`) for links, active states, and the hero; the header bar uses `--header`/`--header-ink` (near-navy with light text).
- **CTA**: amber (`--cta`, `--cta-hover`) with dark text (`--cta-ink`) for primary buttons, the cart badge, and nav highlights — the classic Nordic-retail accent.
- **Semantic accents**: `--deal` (red-orange) for discounts, `--ok` (green) for stock and compatibility success, `--warn` (amber-brown) for compatibility and validation warnings. Each has a `-soft` background variant for notices.
- **Shape**: 10px radius (`--radius`), two soft shadow levels (`--shadow`, `--shadow-lift`). Flat color blocks, no gradients.

Product imagery is generated SVG (`src/components/product-visual.tsx`) driven by each product's `visual` kind and `accent` color — no image assets in the POC.

## Layout Zones

- **Sticky header**: logo, catalog search, cart button with count badge, and a category nav row.
- **Content container**: max-width 1240px. Listing pages use a two-column layout — filter sidebar on the left, toolbar (result count + sort) and product grid on the right. Cart and checkout use a two-column main/summary split.
- **Floating layers**: the compare tray sits at the bottom of the viewport while products are selected; the comparison modal overlays it. The CopilotKit sidebar is closed by default so the storefront is the first visible experience.
- **Footer**: states plainly that this is a demo with no real orders.

## Interaction Rules

- Listing filter state lives in the URL — sidebar changes use `router.replace` (no scroll jump), agent navigation uses `router.push`. Back/forward and shared links just work.
- Out-of-stock products stay visible (badged, add-to-cart disabled) so the alternatives flow has something to react to.
- Cart changes from chat always go through an approval card; the on-page add-to-cart buttons act immediately.
- Compatibility feedback appears wherever parts meet: the comparison modal, agent chat cards, and build recommendations.
- Agent chat cards carry the product detail; chat text stays short.

## Copy Guidelines

- Short, action-oriented labels; EUR prices formatted with `formatPrice` (fi-FI locale, no decimals).
- Warnings name the concrete problem ("uses socket AM5, but … is an LGA1851 board"), not a vague "may be incompatible".
- Demo honesty: checkout, confirmation, and the footer all state that nothing real is ordered or charged.
