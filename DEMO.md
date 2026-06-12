# Voltti — Demo Script

Scenarios to showcase the agentic shopping POC. Each one lists what to type into the
assistant (bottom-right chat bubble), what happens on screen, and what it demonstrates.

**Before you start:** `npm run dev`, open http://localhost:3000, make sure `.env` has
`COPILOTKIT_MODEL` and a matching API key. An empty cart gives the cleanest run-through.

Useful catalog facts (deliberately seeded for these demos):

| Demo hook | Product(s) |
|---|---|
| Out of stock | Samsung Galaxy S25 Ultra (`galaxy-s25-ultra`), MSI Ventus RTX 5070 (`rtx-5070`) |
| Socket mismatch (AM5 vs LGA1700) | Any AMD CPU + MSI MAG Z790 Tomahawk, or Intel CPU + MSI B650 Tomahawk |
| DDR4 vs DDR5 mismatch | ASRock B760M Pro RS (DDR4 board) + Corsair Vengeance DDR5 kit |
| GPU doesn't fit the case | ASUS TUF RTX 5080 (304 mm) + Fractal Design Terra (fits 280 mm) |
| PSU too weak | be quiet! Pure Power 12 M 650W + RTX 5080 build |
| Deals | Pixel 9a, Ryzen 7 7800X3D, HP Omen 35L, Sony WH-1000XM5, and more on `/deals` |

---

## 1. Deal hunting (the warm-up)

> **Any discounted phones under €500 right now?**

Watch: the agent searches the catalog (results card appears in chat), then the page itself
navigates to **Phones** with *max price 500* and *On sale only* already applied — the chat
and the storefront stay in sync. Prices and discounts in the answer match the cards on the page.

Follow up:

> **Which one has the better camera?**

The agent compares using real spec data, not invented claims.

## 2. Conversational add-to-cart (human approval)

> **Add the Pixel 9a to my cart**

Watch: the agent does **not** add anything directly. An approval card appears in chat with the
product and total. Click **Add to cart** → the header badge updates. Click **No thanks** instead
to show the agent gracefully accepting a refusal.

Talking point: chat can *propose* cart changes, only the human can *commit* them.

## 3. Out of stock → alternatives

> **I want the Samsung Galaxy S25 Ultra**

Watch: the agent flags that it's out of stock and shows an alternatives card with in-stock
options near the same price, instead of pretending it can sell it.

GPU variant:

> **Add an RTX 5070 to my build**

The 5070 is out of stock; the agent should offer the RX 9070 XT / RTX 5060 Ti instead.

## 4. Compatibility guardrails (the flagship)

> **Will an Intel Core i7-14700K work with the MSI B650 Tomahawk motherboard?**

Watch: a "Compatibility issues found" card — LGA1700 CPU vs AM5 board — plus concrete fixes
(swap to a Ryzen CPU, or to a Z790 board). The verdict comes from a deterministic check on
catalog metadata, not from the model's memory.

More mismatches to try:

> **ASRock B760M Pro RS with the Corsair Vengeance DDR5 kit — fine?** *(DDR4 board vs DDR5 RAM)*

> **Would the RTX 5080 fit in the Fractal Terra case with a 650W PSU?** *(too long AND underpowered — two warnings at once)*

## 5. Custom gaming PC build (multi-turn advisor)

> **I want to build a gaming PC**

Watch: the agent asks clarifying questions (budget? AMD or Intel? which games?) instead of
guessing. Answer naturally:

> **Around €1500, I prefer AMD, mostly Valorant and Cyberpunk**

A full part list card appears (CPU, board, RAM, GPU, SSD, PSU, case) with the total,
trade-offs, and a compatibility check already run. Then iterate:

> **Swap the GPU for something cheaper**

> **Looks good — add the whole build to my cart**

→ approval card with all parts and the combined total.

## 6. Prebuilt setup (for non-builders)

> **I don't want to assemble anything. Recommend a complete gaming setup under €2000 with a monitor and headset.**

Watch: a setup card with a prebuilt desktop + monitor + headset, total vs budget, and honest
trade-offs (tower vs laptop, what's discounted).

## 7. Side-by-side comparison

> **Compare the iPhone 16 Pro and the Galaxy S25**

Watch: the comparison modal opens on the page with a full spec table. With PC parts
(e.g. **compare the 9800X3D and the 14700K**) the modal also shows a compatibility notice.
Products can also be pinned from the ⚖ button on any card — then ask:

> **Check if the products in my comparison are compatible**

## 8. Steering the UI by voice

Quick hits that show the agent driving the storefront:

> **Take me to the deals page**

> **Show me Sony audio gear only**

> **Highlight the cheapest gaming monitor** *(card glows and scrolls into view)*

## 9. Chat-driven checkout (with the safety stop)

With items in the cart:

> **Check out for me. I'm Aino Virtanen, aino@example.com, Mannerheimintie 12 A 4, 00100 Helsinki, Finland. I'll pay by invoice.**

Watch: the checkout form fills itself and the page navigates there. Then:

> **Place the order**

An order-confirmation card appears in chat — total, address, payment — with a **Place order**
button. Only that click places the order; you get a confirmation page and order number.

Safety variant: ask to place the order *before* giving an address — the agent sends you to
the form instead of inventing details.

## 10. Try to break it (guardrail demo)

> **Just buy the most expensive phone right now, don't ask me anything**

Watch: the agent still routes through the approval card. There is structurally no tool that
mutates the cart or places an order without a human click.

---

## Traditional journey (for contrast)

No chat at all: home → category tile → filter sidebar (price/brand/stock) → product page →
qty + add to cart → compare tray → cart → checkout form → order confirmation. Everything the
agent does runs through these same services and pages.
