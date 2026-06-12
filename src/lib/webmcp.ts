/**
 * WebMCP progressive enhancement (experimental browser API).
 *
 * Exposes a small set of site capabilities to browser agents via
 * `navigator.modelContext` when the browser supports it (Chrome behind the
 * WebMCP flag). The rest of the app never depends on this — it is a no-op
 * everywhere else. The API shape is still in flux, so everything is
 * feature-detected and wrapped in try/catch.
 */
import { searchProducts, getProduct, productSummary } from "./services";

type ModelContext = {
  registerTool: (tool: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    execute: (args: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[] }>;
  }) => { unregister?: () => void } | void;
};

type WebMcpHandlers = {
  navigate: (path: string) => void;
  addToCart: (productId: string, quantity?: number) => boolean;
};

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

export function registerWebMcpTools(handlers: WebMcpHandlers): (() => void) | undefined {
  const modelContext = (globalThis.navigator as Navigator & { modelContext?: ModelContext })?.modelContext;
  if (!modelContext?.registerTool) return undefined;

  const registrations: ({ unregister?: () => void } | void)[] = [];
  try {
    registrations.push(
      modelContext.registerTool({
        name: "search_catalog",
        description: "Search the Voltti electronics catalog by free text, with optional max price in EUR.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search text, e.g. 'gaming laptop'." },
            maxPrice: { type: "number", description: "Maximum price in EUR." },
          },
          required: ["query"],
        },
        execute: async (args) =>
          text(
            searchProducts({ query: String(args.query ?? ""), maxPrice: args.maxPrice ? Number(args.maxPrice) : undefined })
              .slice(0, 8)
              .map(productSummary),
          ),
      }),
      modelContext.registerTool({
        name: "open_page",
        description: "Navigate the store to a path such as /deals, /cart, /c/phones, or /product/<id>.",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string", description: "Site-relative path starting with /." } },
          required: ["path"],
        },
        execute: async (args) => {
          handlers.navigate(String(args.path ?? "/"));
          return text({ ok: true });
        },
      }),
      modelContext.registerTool({
        name: "add_to_cart",
        description: "Add a product to the shopping cart by product id. Fails for out-of-stock products.",
        inputSchema: {
          type: "object",
          properties: {
            productId: { type: "string" },
            quantity: { type: "number" },
          },
          required: ["productId"],
        },
        execute: async (args) => {
          const id = String(args.productId ?? "");
          const ok = handlers.addToCart(id, args.quantity ? Number(args.quantity) : 1);
          return text({ ok, product: ok ? getProduct(id)?.name : undefined, error: ok ? undefined : "Product unavailable" });
        },
      }),
    );
  } catch {
    return undefined;
  }

  return () => {
    for (const registration of registrations) {
      try {
        registration?.unregister?.();
      } catch {
        // ignore
      }
    }
  };
}
