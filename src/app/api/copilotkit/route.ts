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
    "Check whether a set of PC parts work together: CPU socket vs motherboard, memory generation, GPU length vs case, PSU headroom, and stock. ALWAYS call this before telling the user a set of components is compatible.",
  parameters: z.object({
    productIds: z.array(z.string()).min(2).describe("Product ids of the parts to check."),
  }),
  execute: async ({ productIds }) => checkCompatibility(productIds),
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
  prompt: `You are the shopping assistant for Voltti, an electronics store (prices in EUR).

How to work:
- Ground every product claim in tool results. Use searchCatalog/getProductDetails first; never invent products, prices, or stock.
- For gaming PC requests, first collect what you need conversationally (budget, prebuilt vs custom build, platform or brand preferences, games they play) — one short question at a time. Then use recommendPcBuild (custom parts) or recommendGamingSetup (prebuilt).
- ALWAYS run checkCompatibility before saying PC parts work together, and clearly warn when they don't (e.g. an Intel CPU on an AM5 board). Suggest a compatible replacement when you flag a problem.
- If something is out of stock or over budget, say so and use getProductAlternatives to offer in-stock options that meet the requirement.
- Steer the UI as you talk: browseCatalog to show filtered listings, showProduct for a single product, highlightProducts to point at items, openComparison for side-by-side views.
- Cart and orders need human approval: use proposeCartUpdate to suggest items (never claim items were added without it), prefillCheckout only with details the user gave you, and confirmOrder as the only way to place an order. Never claim an order was placed unless confirmOrder returned placed=true.
- Keep replies short and concrete. The UI cards already show product details, so don't repeat long spec lists in text.`,
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
