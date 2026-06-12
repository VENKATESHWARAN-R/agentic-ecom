"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { z } from "zod";
import {
  CopilotSidebar,
  useAgentContext,
  useConfigureSuggestions,
  useFrontendTool,
  useHumanInTheLoop,
  useRenderTool,
} from "@copilotkit/react-core/v2";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  checkCompatibility,
  formatPrice,
  getProduct,
  getProducts,
} from "@/lib/services";
import { useShop } from "@/lib/shop-context";
import type { CheckoutDetails, Product } from "@/lib/types";
import { ProductVisual } from "@/components/product-visual";
import { registerWebMcpTools } from "@/lib/webmcp";

const CATEGORY_VALUES = ["phones", "laptops", "desktops", "components", "monitors", "audio", "accessories", "smart-home"] as const;

function safeParse<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function ProductRow({ product }: { product: Product }) {
  return (
    <div className="agent-product-row">
      <ProductVisual kind={product.visual} accent={product.accent} />
      <div className="info">
        <div className="name">{product.name}</div>
        <div className="meta">
          {product.brand}
          {product.stock <= 0 ? " · out of stock" : product.stock <= 5 ? ` · only ${product.stock} left` : ""}
        </div>
      </div>
      <span className={`price ${product.originalPrice ? "deal" : ""}`}>{formatPrice(product.price)}</span>
    </div>
  );
}

function ProductRows({ ids }: { ids: string[] }) {
  return (
    <>
      {getProducts(ids).map((product) => (
        <ProductRow key={product.id} product={product} />
      ))}
    </>
  );
}

export function ShoppingAssistant() {
  const router = useRouter();
  const pathname = usePathname();
  const shop = useShop();

  // ---------- What the agent can see ----------

  useAgentContext({
    description:
      "Live storefront state: the page the user is looking at, cart contents, comparison selection, and checkout form state.",
    value: {
      currentPath: pathname,
      cart: shop.cart.map((line) => {
        const product = getProduct(line.productId);
        return {
          productId: line.productId,
          name: product?.name ?? line.productId,
          quantity: line.quantity,
          unitPrice: product?.price ?? 0,
        };
      }),
      cartTotal: shop.cartTotal,
      comparisonProductIds: shop.compareIds,
      checkoutForm: {
        ...shop.checkoutDraft,
        complete: Boolean(
          shop.checkoutDraft.fullName &&
            shop.checkoutDraft.email &&
            shop.checkoutDraft.address &&
            shop.checkoutDraft.city &&
            shop.checkoutDraft.postalCode,
        ),
      },
      lastOrderNumber: shop.lastOrder?.number ?? null,
    },
  });

  useConfigureSuggestions({
    available: "before-first-message",
    suggestions: [
      { title: "Build a gaming PC", message: "I want to build a gaming PC for around €1500. Help me pick the parts." },
      { title: "Phone deals", message: "Any discounted phones under €500 right now?" },
      { title: "Check my build", message: "Check if the products in my comparison are compatible with each other." },
      { title: "Headphones advice", message: "I need noise-cancelling headphones for commuting. What do you recommend?" },
    ],
  });

  // ---------- Navigation & UI steering tools ----------

  useFrontendTool({
    name: "browseCatalog",
    description:
      "Navigate the storefront to a product listing with filters applied, so the user can see results on the page. Use after searching the catalog to show matching products.",
    parameters: z.object({
      category: z.enum(CATEGORY_VALUES).optional().describe("Category page to open. Omit to use the search page."),
      query: z.string().optional().describe("Free-text search filter."),
      maxPrice: z.number().optional(),
      brands: z.array(z.string()).optional(),
      dealsOnly: z.boolean().optional(),
      inStockOnly: z.boolean().optional(),
      sort: z.enum(["relevance", "price-asc", "price-desc", "rating"]).optional(),
    }),
    handler: async ({ category, query, maxPrice, brands, dealsOnly, inStockOnly, sort }) => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (maxPrice) params.set("max", String(maxPrice));
      if (brands?.length) params.set("brands", brands.join(","));
      if (dealsOnly && !category) params.set("deals", "1");
      if (dealsOnly && category) params.set("deals", "1");
      if (inStockOnly) params.set("stock", "1");
      if (sort && sort !== "relevance") params.set("sort", sort);
      const base = category ? `/c/${category}` : dealsOnly ? "/deals" : "/search";
      if (base === "/deals") params.delete("deals");
      router.push(`${base}${params.size ? `?${params}` : ""}`);
      return `Opened ${base} with the requested filters. The user can now see the matching products.`;
    },
  });

  useFrontendTool({
    name: "showProduct",
    description: "Open a product's detail page so the user can see its full specs and price.",
    parameters: z.object({ productId: z.string() }),
    handler: async ({ productId }) => {
      const product = getProduct(productId);
      if (!product) return `No product with id "${productId}" exists.`;
      router.push(`/product/${productId}`);
      return `Opened the page for ${product.name}.`;
    },
  });

  useFrontendTool({
    name: "goToPage",
    description: "Navigate to a top-level page of the store: home, deals, cart, or checkout.",
    parameters: z.object({ page: z.enum(["home", "deals", "cart", "checkout"]) }),
    handler: async ({ page }) => {
      router.push(page === "home" ? "/" : `/${page}`);
      return `Opened the ${page} page.`;
    },
  });

  useFrontendTool({
    name: "highlightProducts",
    description: "Visually highlight specific products in the current listing to draw the user's attention to them.",
    parameters: z.object({ productIds: z.array(z.string()) }),
    handler: async ({ productIds }) => {
      shop.setHighlightedIds(productIds);
      return `Highlighted ${productIds.length} product(s) on the page.`;
    },
  });

  useFrontendTool({
    name: "openComparison",
    description:
      "Open the side-by-side comparison view for 2-4 products. Also returns the PC-part compatibility result for the selection.",
    parameters: z.object({ productIds: z.array(z.string()).min(2).max(4) }),
    handler: async ({ productIds }) => {
      shop.setCompareIds(productIds);
      shop.setCompareOpen(true);
      return checkCompatibility(productIds);
    },
  });

  useFrontendTool({
    name: "prefillCheckout",
    description:
      "Fill the checkout form with delivery details the user has given in chat, then open the checkout page. Never invent details — only use what the user explicitly provided.",
    parameters: z.object({
      fullName: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
      paymentMethod: z.enum(["card", "invoice", "financing"]).optional(),
    }),
    handler: async (details) => {
      const patch = Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
      shop.updateCheckoutDraft(patch as Partial<CheckoutDetails>);
      router.push("/checkout");
      return "Checkout form updated with the provided details. The user can review them on the checkout page.";
    },
  });

  // ---------- Human-in-the-loop approvals ----------

  useHumanInTheLoop(
    {
      name: "proposeCartUpdate",
      description:
        "Propose adding products to the cart. The user must approve before anything is added. Use this instead of claiming items were added.",
      parameters: z.object({
        items: z.array(
          z.object({
            productId: z.string(),
            quantity: z.number().min(1).default(1),
          }),
        ),
        reason: z.string().describe("One sentence explaining why these products."),
      }),
      render: ({ args, status, respond }) => {
        const items = (args.items ?? []).filter((item) => item?.productId);
        const products = getProducts(items.map((item) => item.productId!));
        const total = items.reduce(
          (sum, item) => sum + (getProduct(item.productId!)?.price ?? 0) * (item.quantity ?? 1),
          0,
        );
        return (
          <div className="agent-card">
            <h4>Add to cart?</h4>
            {args.reason && <div style={{ marginBottom: 8 }}>{args.reason}</div>}
            <ProductRows ids={products.map((p) => p.id)} />
            <div className="agent-total">Total {formatPrice(total)}</div>
            {status === "executing" && respond ? (
              <div className="hitl-actions">
                <button className="btn btn-sm" onClick={() => respond({ approved: false, note: "User declined." })}>
                  No thanks
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const added: string[] = [];
                    const unavailable: string[] = [];
                    for (const item of items) {
                      if (shop.addToCart(item.productId!, item.quantity ?? 1)) added.push(item.productId!);
                      else unavailable.push(item.productId!);
                    }
                    respond({ approved: true, added, unavailable });
                  }}
                >
                  Add to cart
                </button>
              </div>
            ) : (
              status === "complete" && <div className="tool-status">Resolved.</div>
            )}
          </div>
        );
      },
    },
    [shop.addToCart],
  );

  useHumanInTheLoop(
    {
      name: "confirmOrder",
      description:
        "Ask the user to confirm placing the order for the current cart. Only call when the cart has items and the checkout form is complete (check the storefront context). This is the ONLY way an order can be placed from chat.",
      parameters: z.object({
        note: z.string().optional().describe("Optional short summary of what is being ordered."),
      }),
      render: ({ args, status, respond }) => {
        const missingDetails = !(
          shop.checkoutDraft.fullName &&
          shop.checkoutDraft.email &&
          shop.checkoutDraft.address &&
          shop.checkoutDraft.city &&
          shop.checkoutDraft.postalCode
        );
        return (
          <div className="agent-card">
            <h4>Place this order?</h4>
            {args.note && <div style={{ marginBottom: 8 }}>{args.note}</div>}
            <ProductRows ids={shop.cart.map((line) => line.productId)} />
            <div className="agent-total">Total {formatPrice(shop.cartTotal)}</div>
            <div className="tool-status">
              Delivery to: {shop.checkoutDraft.address ?? "—"}, {shop.checkoutDraft.city ?? "—"} · Payment:{" "}
              {shop.checkoutDraft.paymentMethod ?? "card"}
            </div>
            {status === "executing" && respond ? (
              missingDetails ? (
                <>
                  <div className="notice notice-warn">Delivery details are incomplete — fill them in first.</div>
                  <div className="hitl-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        router.push("/checkout");
                        respond({ placed: false, reason: "Checkout details incomplete; user sent to checkout form." });
                      }}
                    >
                      Open checkout form
                    </button>
                  </div>
                </>
              ) : (
                <div className="hitl-actions">
                  <button className="btn btn-sm" onClick={() => respond({ placed: false, reason: "User cancelled." })}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const order = shop.placeOrder(shop.checkoutDraft as CheckoutDetails);
                      if (order) {
                        router.push("/checkout");
                        respond({ placed: true, orderNumber: order.number, total: order.total });
                      } else {
                        respond({ placed: false, reason: "Cart was empty." });
                      }
                    }}
                  >
                    Place order ({formatPrice(shop.cartTotal)})
                  </button>
                </div>
              )
            ) : (
              status === "complete" && <div className="tool-status">Resolved.</div>
            )}
          </div>
        );
      },
    },
    [shop.cart, shop.cartTotal, shop.checkoutDraft, shop.placeOrder],
  );

  // ---------- Generative UI for server-side tool results ----------

  useRenderTool(
    {
      name: "searchCatalog",
      parameters: z.object({ query: z.string().optional(), category: z.string().optional() }),
      render: ({ status, result }) => {
        const data = safeParse<{ products: { id: string }[]; totalMatches: number }>(result);
        if (status !== "complete" || !data) return <div className="tool-status">Searching the catalog…</div>;
        if (!data.products?.length) return <div className="tool-status">No matching products found.</div>;
        return (
          <div className="agent-card">
            <h4>
              {data.totalMatches} match{data.totalMatches === 1 ? "" : "es"} in the catalog
            </h4>
            <ProductRows ids={data.products.map((p) => p.id)} />
          </div>
        );
      },
    },
    [],
  );

  useRenderTool(
    {
      name: "getProductAlternatives",
      parameters: z.object({ productId: z.string().optional() }),
      render: ({ status, result }) => {
        const data = safeParse<{ original?: { id: string; name: string; inStock: boolean }; alternatives: { id: string }[] }>(result);
        if (status !== "complete" || !data) return <div className="tool-status">Looking for alternatives…</div>;
        return (
          <div className="agent-card">
            <h4>
              Alternatives{data.original ? ` for ${data.original.name}` : ""}
              {data.original && !data.original.inStock ? " (out of stock)" : ""}
            </h4>
            <ProductRows ids={(data.alternatives ?? []).map((p) => p.id)} />
          </div>
        );
      },
    },
    [],
  );

  useRenderTool(
    {
      name: "checkCompatibility",
      parameters: z.object({ productIds: z.array(z.string()).optional() }),
      render: ({ status, result }) => {
        const data = safeParse<{ compatible: boolean; warnings: string[]; notes: string[]; productIds: string[] }>(result);
        if (status !== "complete" || !data) return <div className="tool-status">Checking compatibility…</div>;
        return (
          <div className="agent-card">
            <h4 style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {data.compatible ? (
                <>
                  <CheckCircle2 size={16} color="var(--ok)" /> Parts are compatible
                </>
              ) : (
                <>
                  <AlertTriangle size={16} color="var(--warn)" /> Compatibility issues found
                </>
              )}
            </h4>
            {data.warnings.length > 0 && (
              <ul className="warning-list">
                {data.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            {data.notes.length > 0 && (
              <div className="tool-status">{data.notes.join(" ")}</div>
            )}
          </div>
        );
      },
    },
    [],
  );

  useRenderTool(
    {
      name: "recommendPcBuild",
      parameters: z.object({ budget: z.number().optional() }),
      render: ({ status, result }) => {
        const data = safeParse<{
          ids: string[];
          totalPrice: number;
          summary: string;
          tradeoffs: string[];
          compatibility: { compatible: boolean; warnings: string[] };
        }>(result);
        if (status !== "complete" || !data) return <div className="tool-status">Putting a build together…</div>;
        return (
          <div className="agent-card">
            <h4>Suggested PC build</h4>
            <div style={{ marginBottom: 8 }}>{data.summary}</div>
            <ProductRows ids={data.ids} />
            <div className="agent-total">Total {formatPrice(data.totalPrice)}</div>
            {!data.compatibility.compatible && (
              <ul className="warning-list">
                {data.compatibility.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
        );
      },
    },
    [],
  );

  useRenderTool(
    {
      name: "recommendGamingSetup",
      parameters: z.object({ budget: z.number().optional() }),
      render: ({ status, result }) => {
        const data = safeParse<{ ids: string[]; totalPrice: number; summary: string; warnings: string[] }>(result);
        if (status !== "complete" || !data) return <div className="tool-status">Picking a setup…</div>;
        return (
          <div className="agent-card">
            <h4>Suggested gaming setup</h4>
            <div style={{ marginBottom: 8 }}>{data.summary}</div>
            <ProductRows ids={data.ids} />
            <div className="agent-total">Total {formatPrice(data.totalPrice)}</div>
            {data.warnings?.length > 0 && (
              <ul className="warning-list">
                {data.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
        );
      },
    },
    [],
  );

  // ---------- WebMCP progressive enhancement ----------

  useEffect(() => {
    return registerWebMcpTools({
      navigate: (path) => router.push(path),
      addToCart: (productId, quantity) => shop.addToCart(productId, quantity),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CopilotSidebar
      defaultOpen={false}
      labels={{
        chatInputPlaceholder: "Ask about products, deals, or PC builds…",
        modalHeaderTitle: "Voltti Assistant",
        welcomeMessageText: "Hi! I can find products, compare specs, check PC part compatibility, and build your cart — what are you looking for?",
        chatDisclaimerText: "Demo store — the assistant never places orders without your approval.",
      }}
    />
  );
}
