# Design

SignalCart should feel like a practical electronics commerce tool, not a marketing page. The storefront is dense enough for shopping, but still polished enough to make the agentic interaction feel credible in a demo.

## Design Goals

- Make the first screen the usable commerce experience.
- Keep the agent visible as a shopping tool, not a separate chatbot destination.
- Keep product cards scannable: price, stock, discount, specs, and actions should be easy to find.
- Make compatibility and checkout safety obvious.
- Keep visual styling consistent across storefront, advisor, cart, and checkout.

## Visual Language

- Neutral commerce base: white panels, light gray page background, restrained borders.
- Accent colors communicate meaning:
  - Blue for primary actions and selected products.
  - Green for stock, success, and strong deal states.
  - Red for warnings and unavailable states.
  - Amber for deal/price emphasis.
- Product visuals are generated with CSS shapes to avoid asset dependencies during the POC.

## Layout

The desktop layout has three work zones:

- Left rail: search, quick filters, budget, advisor status.
- Center: catalog, cart, or checkout.
- Right rail: compatibility panel, cart summary, live deals.

On smaller screens the layout collapses into a single column. The CopilotKit sidebar is closed by default so the storefront remains the first visible experience.

## Interaction Rules

- Icon buttons are used for shortlist, compare, and add-to-cart actions.
- The agent may draft a cart, but the user must approve before items are added.
- Checkout remains a mock review with explicit human approval.
- Product selection should immediately update the compatibility panel.
- The gaming advisor should update the UI and provide tradeoffs, not just chat text.

## Copy Guidelines

- Keep labels short and action-oriented.
- Avoid explaining UI mechanics inside the app.
- Warnings should name the concrete incompatibility, such as CPU socket versus motherboard socket.
- Recommendation copy should state why a product fits, what the tradeoff is, and whether it is within budget.
