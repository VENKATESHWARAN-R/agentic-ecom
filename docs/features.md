# Features

This document describes the current POC feature set and the intended user journeys.

## Storefront Browsing

Users can browse the catalog by top-level pages:

- Store
- Offers
- Phones
- Gaming
- Parts
- Cart

The catalog includes phones, gaming laptops, gaming desktops, PC components, monitors, headsets, and smart-home devices.

## Search And Filters

The UI supports local text search, quick category navigation, and budget filtering. The agent can apply filters through the `applyProductFilters` frontend tool.

## Offers

Products with `originalPrice` are treated as discounted offers. Deal pages and deal panels use the same catalog metadata.

## Gaming Setup Advisor

The gaming setup flow recommends a practical setup from inventory based on:

- Budget
- Game/use-case
- Laptop versus desktop preference
- Monitor inclusion
- Brand preferences, reserved for future scoring improvements

The deterministic recommendation service chooses catalog items, calculates total price, and returns tradeoffs and warnings.

## Compatibility Checks

Compatibility checks inspect structured product metadata:

- CPU socket
- Motherboard socket
- Memory type
- GPU power estimate
- PSU wattage

The first supported warning is the high-value PC-build case: an Intel CPU with an AM5 motherboard, or an AMD AM5 CPU with an LGA motherboard.

## Cart And Mock Checkout

Users can add products directly from cards. The agent can draft a cart through tools, but human approval is required before adding a draft to the cart.

Checkout is deliberately mocked. It displays the reviewed items and total, then asks for explicit demo approval.

## Agentic Shopping

The copilot can:

- Search the catalog.
- Recommend products.
- Find alternatives for unavailable products.
- Highlight products in the UI.
- Open a comparison.
- Draft a cart.
- Navigate the storefront.
- Warn about compatibility issues.

## WebMCP Enhancement

The app registers browser-native tools only when `navigator.modelContext.registerTool` is available. This keeps the main app usable in normal browsers while allowing browser agents to discover structured page capabilities in supported environments.

Registered browser tools:

- `search_catalog`
- `navigate_storefront`
- `add_product_to_cart`

Checkout still requires human approval.
