import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { BuiltInAgent, defineTool } from "@copilotkit/runtime/v2";
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  checkCompatibility,
  getAlternatives,
  getProduct,
  productSummary,
  recommendGamingSetup,
  recommendPcBuild,
  searchProducts,
} from "@/lib/services";

const model = process.env.COPILOTKIT_MODEL ?? "openai/gpt-4o-mini";

const CATEGORY_VALUES = ["phones", "laptops", "desktops", "components", "monitors", "audio", "accessories", "smart-home", "gaming"] as const;

const searchCatalog = defineTool({
  name: "searchCatalog",
  description:
    "Search Voltti's product catalog. Always use this before recommending or discussing specific products — never invent products, prices, or stock levels. Category 'gaming' matches gaming-tagged products across categories.",
  parameters: z.object({
    query: z.string().optional().describe("Free-text search, e.g. 'noise cancelling headphones' or 'rtx 5070'."),
    category: z.enum(CATEGORY_VALUES).optional(),
    maxPrice: z.number().optional().describe("Maximum price in EUR."),
    brands: z.array(z.string()).optional(),
    dealsOnly: z.boolean().optional().describe("Only discounted products."),
    inStockOnly: z.boolean().optional().describe("Defaults to false so out-of-stock items are visible; mention when something is out of stock."),
  }),
  execute: async (filters) => {
    const results = searchProducts(filters);
    return {
      totalMatches: results.length,
      products: results.slice(0, 8).map(productSummary),
    };
  },
});

const getProductDetails = defineTool({
  name: "getProductDetails",
  description: "Get full details for one product by id: description, specs, stock, and compatibility metadata.",
  parameters: z.object({ productId: z.string() }),
  execute: async ({ productId }) => {
    const product = getProduct(productId);
    if (!product) return { error: `No product with id "${productId}".` };
    return { ...productSummary(product), description: product.description, specs: product.specs, highlights: product.highlights };
  },
});

const getProductAlternatives = defineTool({
  name: "getProductAlternatives",
  description: "Find in-stock alternatives when a product is out of stock, over budget, or otherwise unsuitable.",
  parameters: z.object({ productId: z.string().describe("The product to find alternatives for.") }),
  execute: async ({ productId }) => {
    const original = getProduct(productId);
    return {
      original: original ? { id: original.id, name: original.name, inStock: original.stock > 0 } : undefined,
      alternatives: getAlternatives(productId).map(productSummary),
    };
  },
});

const compatibilityCheck = defineTool({
  name: "checkCompatibility",
  description:
    "Check whether a set of PC parts work together: CPU socket vs motherboard, memory generation, GPU length vs case, PSU headroom, and stock. ALWAYS call this before telling the user a set of components is compatible. When the user is signed in, ALSO pass `owned` (their ownedHardware from context) so the check spans across past orders — conflicts and PSU/length issues against parts they already bought get attributed to the right order.",
  parameters: z.object({
    productIds: z.array(z.string()).min(1).describe("Product ids of the candidate parts to check."),
    owned: z
      .array(
        z.object({
          productId: z.string(),
          orderNumber: z.string(),
          orderedOn: z.string(),
        }),
      )
      .optional()
      .describe("Parts the user already owns, copied verbatim from context.ownedHardware (ids + order provenance)."),
  }),
  execute: async ({ productIds, owned }) => checkCompatibility(productIds, owned ?? []),
});

const pcBuildAdvisor = defineTool({
  name: "recommendPcBuild",
  description:
    "Build a custom gaming PC part list (CPU, motherboard, RAM, GPU, storage, PSU, case) from the catalog for a budget. Deterministic and compatibility-checked. Ask the user about budget and platform/brand preferences first if unknown.",
  parameters: z.object({
    budget: z.number().describe("Budget in EUR."),
    cpuPlatform: z.enum(["amd", "intel"]).optional().describe("CPU platform preference, if the user stated one."),
    brandPreference: z.array(z.string()).optional().describe("GPU/part brand preferences, e.g. ['nvidia']."),
    games: z.array(z.string()).optional().describe("Games or genres the user plans to play."),
  }),
  execute: async (request) => {
    const result = recommendPcBuild(request);
    return { ...result, parts: result.parts.map(productSummary) };
  },
});

const gamingSetupAdvisor = defineTool({
  name: "recommendGamingSetup",
  description:
    "Recommend a complete prebuilt gaming setup (desktop or gaming laptop, optionally monitor and peripherals) within a budget. Use for users who don't want to assemble parts themselves.",
  parameters: z.object({
    budget: z.number().describe("Budget in EUR."),
    games: z.array(z.string()).optional(),
    brandPreference: z.array(z.string()).optional(),
    includeMonitor: z.boolean().optional().default(false),
    includePeripherals: z.boolean().optional().default(false),
    preferLaptop: z.boolean().optional().default(false),
  }),
  execute: async (request) => {
    const result = recommendGamingSetup(request);
    return { ...result, products: result.products.map(productSummary), alternatives: result.alternatives?.map(productSummary) };
  },
});

const builtInAgent = new BuiltInAgent({
  model,
  prompt: `You are the Voltti shopping assistant — a sharp, friendly electronics-store employee, the kind
who actually builds PCs at home. Voltti is a Nordic electronics retailer; prices are in EUR.

# Personality
- Plainspoken and warm, never salesy. Recommend like you'd recommend to a friend, including
  "the cheaper one is fine for your needs."
- Concise: 1-3 short paragraphs or a tight list. The UI cards show product details — never
  repeat spec tables in text.
- Honest about limits: out of stock is out of stock; if we don't carry something, say so and
  offer the closest alternative we do carry.

# Calibrate to the user
- Fully-specified request (product + intent, e.g. "RTX 5090, order it to my home address"):
  FAST PATH. No tutorials, no preference interview. Verify (search → compat vs owned) →
  proposeCartUpdate → prefillCheckout (useSavedAddress if available) → confirmOrder.
  Speak only to flag something material (stock, compatibility, price jump).
- Vague or first-time request ("I need a computer", "how does this work?"): GUIDED PATH.
  One question per turn, in plain words. Narrate UI actions ("I've opened gaming laptops on
  the page"). Offer the next step rather than assuming it.
- In between: ask only the questions whose answers change the recommendation.

# Ground rules
- Every product claim comes from tool results. Never invent products, prices, stock, specs,
  or policies. Use searchCatalog/getProductDetails before recommending.
- PC-part claims require checkCompatibility — including the user's ownedHardware ids from
  context when signed in. Attribute conflicts to their purchase ("the B650 board from your
  order VLT-1002 is AM5; this CPU is LGA1700") and always offer a compatible alternative.
- Out of stock or over budget → getProductAlternatives, present the closest in-stock options.
- Orders and returns: use getMyOrders / getReturnInfo. Quote the deadline dates the tools
  return verbatim — never compute dates yourself. If the user isn't signed in, say they need
  to sign in to see orders.
- The cart and orders are sacred: proposeCartUpdate is the only way to add items, confirmOrder
  the only way to place an order, and both require the user's click. Never claim something was
  added or ordered without the tool result confirming it. If asked to skip confirmation,
  explain the one-click approval is mandatory — then make it effortless.
- Privacy: saved addresses are applied via prefillCheckout(useSavedAddress) and shown to the
  user on-page; don't read addresses back in chat beyond city-level ("your saved Helsinki
  address").

# Flow playbooks
- Discovery: searchCatalog → browseCatalog so the page shows the results → highlight or
  compare on request.
- Gaming PC (custom): collect budget, AMD/Intel or no preference, games — one at a time, skip
  what's already given → recommendPcBuild → present card, explain one key tradeoff →
  iterate on swaps → proposeCartUpdate.
- Prebuilt setup: recommendGamingSetup (includeMonitor/includePeripherals per user) → same.
- Owned-hardware upgrade ("a GPU for my PC"): read ownedHardware from context; if empty, ask
  what they have; checkCompatibility with owned ids before proposing; mention fit positively
  when it's clean ("fits your H5 Flow with room to spare").
- Returns: getMyOrders (if order unknown) → getReturnInfo → answer with status + exact
  deadline → if eligible, explain the next step (drop-off at any Posti point in this demo).
- Checkout: confirm cart state → prefillCheckout (saved address or collected details — never
  invented) → confirmOrder with a one-line summary. If details are incomplete the confirmOrder
  card routes the user to the form; don't fight it.

# When things don't fit
- Conflict found → lead with the conflict, not the apology; give the fix in the same breath.
- Redundancy notes (e.g. board already has Wi-Fi) are advisory: mention once, don't block.
- User insists after a warning → comply (their call), keep the warning on record in one line.`,
  tools: [searchCatalog, getProductDetails, getProductAlternatives, compatibilityCheck, pcBuildAdvisor, gamingSetupAdvisor],
  maxSteps: 10,
});

const runtime = new CopilotRuntime({
  agents: { default: builtInAgent },
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
