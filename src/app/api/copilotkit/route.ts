import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { BuiltInAgent, defineTool } from "@copilotkit/runtime/v2";
import { NextRequest } from "next/server";
import { z } from "zod";
import { checkCompatibility, getAlternatives, getProduct, recommendGamingSetup, searchProducts } from "@/lib/services";

const model = process.env.COPILOTKIT_MODEL ?? "openai/gpt-4o-mini";

const searchCatalog = defineTool({
  name: "searchCatalog",
  description: "Search SignalCart's electronics catalog. Use this before recommending products or alternatives.",
  parameters: z.object({
    query: z.string().optional().describe("Natural language search text, for example 'discounted phones' or 'RTX gaming desktop'."),
    category: z.enum(["phones", "laptops", "desktops", "components", "accessories", "smart-home", "gaming"]).optional(),
    maxPrice: z.number().optional().describe("Maximum price in EUR."),
    dealOnly: z.boolean().optional().describe("Whether to only return discounted products."),
    inStockOnly: z.boolean().optional().default(true),
  }),
  execute: async (filters) => {
    return {
      products: searchProducts(filters).slice(0, 8),
      count: searchProducts(filters).length,
    };
  },
});

const getProductAlternatives = defineTool({
  name: "getProductAlternatives",
  description: "Find in-stock alternatives if a requested product is unavailable or not ideal.",
  parameters: z.object({
    productId: z.string().describe("The product id to replace."),
  }),
  execute: async ({ productId }) => ({
    original: getProduct(productId),
    alternatives: getAlternatives(productId),
  }),
});

const compatibilityCheck = defineTool({
  name: "checkCompatibility",
  description: "Check whether selected PC components are compatible, especially CPU socket, motherboard socket, memory, GPU, and PSU.",
  parameters: z.object({
    productIds: z.array(z.string()).describe("Product ids selected for the build."),
  }),
  execute: async ({ productIds }) => checkCompatibility(productIds),
});

const gamingSetupAdvisor = defineTool({
  name: "recommendGamingSetup",
  description: "Recommend a practical gaming setup from the catalog based on budget, games, and preferences.",
  parameters: z.object({
    budget: z.number().describe("Budget in EUR."),
    games: z.array(z.string()).optional().describe("Games or genres the user wants to play."),
    brandPreference: z.array(z.string()).optional().describe("Preferred brands if the user named any."),
    includeMonitor: z.boolean().optional().default(false),
    preferLaptop: z.boolean().optional().default(false),
  }),
  execute: async (request) => recommendGamingSetup(request),
});

const builtInAgent = new BuiltInAgent({
  model,
  prompt:
    "You are SignalCart's electronics shopping copilot. Help users shop through conversation and UI tools. Ask concise follow-up questions for ambiguous gaming builds, use catalog tools before recommending, flag unavailable items, and always call compatibility checks before saying a PC component set works. Never claim checkout is complete; prepare a cart draft and ask for human confirmation.",
  tools: [searchCatalog, getProductAlternatives, compatibilityCheck, gamingSetupAdvisor],
  maxSteps: 5,
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
