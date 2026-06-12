# Voltti — Demo Script

Scenarios to showcase the agentic shopping POC. Each one lists what to type into the
assistant (bottom-right chat bubble), what happens on screen, and what it demonstrates.

**Before you start:** `npm run dev`, open http://localhost:3000, make sure `.env` has
`COPILOTKIT_MODEL` and a matching API key. An empty cart gives the cleanest run-through.
Switch demo accounts from the **avatar menu** in the header (top right) — scenarios 11–16
depend on who's signed in.

Useful catalog facts (deliberately seeded for these demos):

| Demo hook | Product(s) |
|---|---|
| Out of stock | Samsung Galaxy S25 Ultra (`galaxy-s25-ultra`), MSI Ventus RTX 5070 (`rtx-5070`) |
| Socket mismatch (AM5 vs LGA1700) | Any AMD CPU + MSI MAG Z790 Tomahawk, or Intel CPU + MSI B650 Tomahawk |
| DDR4 vs DDR5 mismatch | ASRock B760M Pro RS (DDR4 board) + Corsair Vengeance DDR5 kit |
| GPU doesn't fit the case | ASUS TUF RTX 5080 (304 mm) + Fractal Design Terra (fits 280 mm) |
| PSU too weak | be quiet! Pure Power 12 M 650W + RTX 5080 build |
| Flagship / fast path | ASUS ROG Astral RTX 5090 (`rtx-5090`, only 2 in stock) |
| Wi-Fi redundancy | TP-Link Archer TXE75E adapter vs a board that already has Wi-Fi |
| Deals | Pixel 9a, Ryzen 7 7800X3D, HP Omen 35L, Sony WH-1000XM5, and more on `/deals` |

## Demo personas

Switch from the header avatar menu. Each persona shows a different facet of the assistant.

| Persona | Story | Use for |
|---|---|---|
| **Guest** (default) | Signed out | Order tools decline politely ("sign in to see orders") |
| **Elina Laine** | Brand-new account, 0 orders | Empty `/account` state; the **guided novice** path |
| **Aino Virtanen** | Returning builder, mid-PC-build, 3 orders | **Returns** Q&A, **cross-order** conflicts, the **redundancy** nudge |
| **Sami Korhonen** | Power user, **28 orders** over 18 months | The **expert fast path**; the **context-discipline** story |

Aino owns (from her orders): a Fractal Terra case (fits 280 mm GPUs), a 650 W PSU, an
AM5/DDR5 B650 board with built-in Wi-Fi, a DDR5 kit, and a 7800X3D (in transit). Every
cross-order demo below falls out of that profile.

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

# Persona scenarios

Switch accounts from the header avatar menu before each block.

## 11. Returns Q&A — *sign in as Aino*

> **Can I still return the motherboard I ordered?**

Watch: the agent calls `getMyOrders` / `getReturnInfo` and returns a card for **VLT-1002**
with an eligible badge and the **exact deadline** ("Return by 30 Jun 2026 · 18 days left").
The date is computed by code — the model only quotes it. Follow up:

> **And the case from a month ago?**

VLT-1001's window is closed; the agent says so plainly. (Try the in-transit order too — the
Ryzen 7800X3D — and it explains the window opens on delivery.)

## 12. Cross-order compatibility — *as Aino* (the flagship)

> **Add an Intel Core i7-14700K to my cart**

Watch: the agent flags the conflict against the **AM5 B650 board from order VLT-1002** (and
the AM5 7800X3D in transit) — parts that were never in the same order — and offers a
compatible AM5 CPU instead. Then push it:

> **I know, add it anyway**

The `proposeCartUpdate` approval card shows the **same conflict inline** ("Checked against what
you own"), attributed to VLT-1002. The safety net is structural — it fires even if the model's
prose had missed it.

## 13. Redundancy nudge — *as Aino*

> **Add that TP-Link Wi-Fi PCIe adapter to my cart**

Watch: not a blocker, but a note — the B650 Tomahawk she already owns has built-in Wi-Fi, so
the adapter may be unnecessary. Advisory, mentioned once.

## 14. Expert fast path — *sign in as Sami*

> **I want an RTX 5090 — order it to my home address**

Watch: no preference interview. The agent verifies stock and compatibility (the 5090 *fits*
Sami's 365 mm case, but his 850 W PSU is flagged as light for a 5090 + i7 system, with an
upgrade offered), then proposes the cart and prefills checkout **with his saved address —
which never appears in the chat**. Two clicks total: approve cart, place order.

Frictionless variant (no flags at all):

> **Order the Odyssey G7 monitor to my home address**

## 15. Novice guided path — *sign in as Elina*

> **Hi, I've never used this — I need a laptop for studying**

Watch: one question at a time (budget? portability? battery?), plain language, narrated UI
navigation. No order-history tools are called (she has none). The opposite end of the
calibration dial from Sami.

## 16. Context discipline — *as Sami*

> **What have I ordered this year?**

Watch: paginated summaries (5 first, "ask for more"), not a 28-order dump. The talking point:
Sami has 28 orders, but the agent's always-on context holds only a **derived ≤6-line
owned-hardware profile** — a customer with 1,000 orders would produce the same tiny profile.
Order history lives behind tools; the saved address never enters the model at all.

---

## Traditional journey (for contrast)

No chat at all: home → category tile → filter sidebar (price/brand/stock) → product page →
qty + add to cart → compare tray → cart → checkout form → order confirmation. Everything the
agent does runs through these same services and pages.
