"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
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
  formatDate,
  formatPrice,
  getProduct,
  getProducts,
} from "@/lib/services";
import {
  getOrderDetail,
  getOrdersFor,
  ordersForUser,
  ownedHardwareProfile,
  seedOrders,
} from "@/lib/orders";
import { useShop } from "@/lib/shop-context";
import type { CheckoutDetails, OrderStatus, Product, ReturnEligibility } from "@/lib/types";
import { ProductVisual } from "@/components/product-visual";
import { registerWebMcpTools } from "@/lib/webmcp";

const STATUS_LABEL: Record<OrderStatus, string> = {
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
};

type OrderSummaryShape = { number: string; placedAt: string; status: OrderStatus; total: number; items: string[] };
type ReturnInfoShape = {
  signedIn: boolean;
  found?: boolean;
  orderNumber?: string;
  policy?: string;
  order?: { number: string; status: OrderStatus; deliveredAt?: string; returnEligibility: ReturnEligibility; items: string[] };
};

function OrdersCard({ status, result }: { status: string; result: string | undefined }) {
  if (status !== "complete") return <div className="tool-status">Fetching your orders…</div>;
  const data = safeParse<{ signedIn: boolean; total?: number; offset?: number; returned?: number; orders?: OrderSummaryShape[] }>(result);
  if (!data) return <div className="tool-status">Couldn&apos;t read your orders.</div>;
  if (!data.signedIn)
    return (
      <div className="agent-card">
        <h4>Sign in to see orders</h4>
        <div className="tool-status">Pick a demo account from the menu to view order history.</div>
      </div>
    );
  if (!data.orders?.length) return <div className="agent-card"><h4>No orders found</h4></div>;
  const shown = (data.offset ?? 0) + (data.returned ?? data.orders.length);
  return (
    <div className="agent-card">
      <h4>
        {data.total} order{data.total === 1 ? "" : "s"}
      </h4>
      {data.orders.map((order) => (
        <div key={order.number} className="agent-order-row">
          <div className="agent-order-main">
            <span className="agent-order-number">{order.number}</span>
            <span className="agent-order-items">{order.items.join(", ")}</span>
          </div>
          <div className="agent-order-side">
            <span className={`status-chip status-${order.status}`}>{STATUS_LABEL[order.status]}</span>
            <span className="agent-order-date">{formatDate(order.placedAt)}</span>
          </div>
        </div>
      ))}
      {typeof data.total === "number" && shown < data.total && (
        <div className="tool-status">
          Showing {shown} of {data.total} — ask for more to see older orders.
        </div>
      )}
    </div>
  );
}

const RETURN_BADGE: Record<ReturnEligibility["status"], { label: string; cls: string }> = {
  eligible: { label: "Returnable", cls: "status-delivered" },
  closed: { label: "Closed", cls: "status-closed" },
  "awaiting-delivery": { label: "In transit", cls: "status-shipped" },
  cancellable: { label: "Processing", cls: "status-processing" },
};

function ReturnInfoCard({ status, result }: { status: string; result: string | undefined }) {
  if (status !== "complete") return <div className="tool-status">Checking the return window…</div>;
  const data = safeParse<ReturnInfoShape>(result);
  if (!data) return <div className="tool-status">Couldn&apos;t read return info.</div>;
  if (!data.signedIn)
    return (
      <div className="agent-card">
        <h4>Sign in to see returns</h4>
        <div className="tool-status">Pick a demo account from the menu first.</div>
      </div>
    );
  if (!data.found || !data.order)
    return (
      <div className="agent-card">
        <h4>No order {data.orderNumber ?? ""} found</h4>
      </div>
    );
  const eligibility = data.order.returnEligibility;
  const badge = RETURN_BADGE[eligibility.status];
  return (
    <div className="agent-card">
      <h4 style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {data.order.number}
        <span className={`status-chip ${badge.cls}`}>{badge.label}</span>
      </h4>
      <div className="tool-status">{data.order.items.join(", ")}</div>
      {eligibility.status === "eligible" && (
        <div className="return-line return-ok">
          Return by {formatDate(eligibility.deadline!)}
          {eligibility.daysLeft != null ? ` · ${eligibility.daysLeft} days left` : ""}
        </div>
      )}
      {eligibility.status === "closed" && <div className="return-line return-muted">The return window has closed.</div>}
      {eligibility.status === "awaiting-delivery" && (
        <div className="return-line return-warn">Not delivered yet — the return window opens on delivery.</div>
      )}
      {eligibility.status === "cancellable" && (
        <div className="return-line return-warn">Still processing — cancellable until it ships.</div>
      )}
      {data.policy && <div className="tool-status">{data.policy}</div>}
    </div>
  );
}

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
  const { personaId, sessionOrders } = shop;

  // Derived, bounded customer memory (see docs/architecture.md). Recomputed only when the
  // persona or this session's orders change. The same ≤6-entry profile whether
  // the customer has 3 orders or 1,000. ownedRefs (ids + provenance) are what
  // the agent passes to checkCompatibility and what the safety net re-checks.
  const ownedParts = useMemo(
    () => ownedHardwareProfile(personaId, [...sessionOrders, ...seedOrders]),
    [personaId, sessionOrders],
  );
  const ownedRefs = useMemo(
    () => ownedParts.map((part) => ({ productId: part.productId, orderNumber: part.orderNumber, orderedOn: part.orderedOn })),
    [ownedParts],
  );
  const ownedHardware = useMemo(
    () =>
      ownedParts.map((part) => {
        const product = getProduct(part.productId);
        return {
          productId: part.productId,
          category: part.category,
          socket: product?.compat?.socket ?? null,
          memoryType: product?.compat?.memoryType ?? null,
          wifi: Boolean(product?.tags.includes("wifi")),
          orderNumber: part.orderNumber,
          orderedOn: part.orderedOn,
          inTransit: Boolean(part.inTransit),
        };
      }),
    [ownedParts],
  );
  const ordersTotal = useMemo(
    () => ordersForUser(personaId, [...sessionOrders, ...seedOrders]).length,
    [personaId, sessionOrders],
  );

  // ---------- What the agent can see ----------
  // Context budget (see docs/architecture.md): derived/bounded facts only. Raw order history is
  // NOT here (paginated behind getMyOrders); the saved address is NEVER here
  // (applied via prefillCheckout(useSavedAddress) — §4.3).

  useAgentContext({
    description:
      "Live storefront + signed-in customer state: who they are, what PC hardware they already own (derived, ≤6 entries), the page they're on, cart, comparison, and whether checkout is complete. Fetch order history with getMyOrders and returns with getReturnInfo — they are not in this context. The saved address never appears here.",
    value: {
      user: shop.activeUser
        ? {
            signedIn: true,
            name: shop.activeUser.name.split(" ")[0],
            persona: shop.activeUser.personaLabel,
            ordersTotal,
            hasSavedAddress: Boolean(shop.activeUser.savedAddress),
            preferredPayment: shop.activeUser.preferredPayment ?? null,
          }
        : { signedIn: false },
      ownedHardware,
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

  const suggestions = useMemo(() => {
    if (personaId === "aino") {
      return [
        { title: "Return my motherboard?", message: "Can I still return the motherboard I ordered?" },
        { title: "Does an i7 fit?", message: "Will an Intel Core i7-14700K work with my current setup?" },
        { title: "Upgrade my GPU", message: "I want a new graphics card for my PC. What fits my build?" },
        { title: "My recent orders", message: "What have I ordered recently?" },
      ];
    }
    if (personaId === "sami") {
      return [
        { title: "Order an RTX 5090", message: "I want an RTX 5090 — order it to my home address." },
        { title: "My order history", message: "What have I ordered this year?" },
        { title: "A 4K gaming monitor", message: "Recommend a 4K gaming monitor that suits my setup." },
        { title: "Office headphones", message: "I need noise-cancelling headphones for the office." },
      ];
    }
    return [
      { title: "Build a gaming PC", message: "I want to build a gaming PC for around €1500. Help me pick the parts." },
      { title: "Phone deals", message: "Any discounted phones under €500 right now?" },
      { title: "Check my build", message: "Check if the products in my comparison are compatible with each other." },
      { title: "Headphones advice", message: "I need noise-cancelling headphones for commuting. What do you recommend?" },
    ];
  }, [personaId]);

  useConfigureSuggestions({ available: "before-first-message", suggestions }, [suggestions]);

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

  useFrontendTool(
    {
      name: "prefillCheckout",
      description:
        "Fill the checkout form and open the checkout page. Set useSavedAddress: true to apply the signed-in user's saved delivery address — the address itself never appears in chat, only on the page. Otherwise pass only the delivery details the user explicitly gave you; never invent details.",
      parameters: z.object({
        useSavedAddress: z
          .boolean()
          .optional()
          .describe("Apply the signed-in persona's saved address. Use this when the user says 'my home address'."),
        fullName: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
        paymentMethod: z.enum(["card", "invoice", "financing"]).optional(),
      }),
      handler: async ({ useSavedAddress, ...details }) => {
        if (useSavedAddress) {
          const applied = shop.applySavedAddress();
          router.push("/checkout");
          return applied
            ? "Saved address applied. The user can review it on the checkout page."
            : "No saved address on file — ask the user for their delivery details instead.";
        }
        const patch = Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
        shop.updateCheckoutDraft(patch as Partial<CheckoutDetails>);
        router.push("/checkout");
        return "Checkout form updated with the provided details. The user can review them on the checkout page.";
      },
    },
    [shop.applySavedAddress, shop.updateCheckoutDraft],
  );

  // ---------- Identity-scoped order/return tools (frontend; read the active persona) ----------

  useFrontendTool(
    {
      name: "getMyOrders",
      description:
        "List the signed-in customer's recent orders as compact summaries. Results are PAGINATED — default 5, max 20 per call; never request more than you need. Use the returned `total` and `offset` to fetch older orders only if the user asks.",
      parameters: z.object({
        limit: z.number().min(1).max(20).optional().describe("How many orders to return (default 5)."),
        offset: z.number().min(0).optional().describe("Skip this many of the newest orders, for pagination."),
      }),
      handler: async ({ limit, offset }) => {
        if (personaId === "guest") return { signedIn: false };
        const merged = [...sessionOrders, ...seedOrders];
        const page = getOrdersFor(personaId, { limit: limit ?? 5, offset: offset ?? 0 }, merged);
        return { signedIn: true, total: page.total, offset: offset ?? 0, returned: page.orders.length, orders: page.orders };
      },
      render: ({ status, result }) => <OrdersCard status={status} result={result} />,
    },
    [personaId, sessionOrders],
  );

  useFrontendTool(
    {
      name: "getReturnInfo",
      description:
        "Get the return status and exact return-by date for one of the signed-in customer's orders. Quote the deadline the tool returns verbatim — never compute dates yourself.",
      parameters: z.object({ orderNumber: z.string().describe("Order number, e.g. VLT-1002.") }),
      handler: async ({ orderNumber }) => {
        if (personaId === "guest") return { signedIn: false };
        const merged = [...sessionOrders, ...seedOrders];
        const detail = getOrderDetail(personaId, orderNumber, merged);
        if (!detail) return { signedIn: true, found: false, orderNumber };
        return {
          signedIn: true,
          found: true,
          policy: "30-day free returns from the delivery date; item unopened or unused. Drop off at any Posti point (demo).",
          order: {
            number: detail.number,
            status: detail.status,
            deliveredAt: detail.deliveredAt,
            returnEligibility: detail.returnEligibility,
            items: detail.lines.map((line) => line.name),
          },
        };
      },
      render: ({ status, result }) => <ReturnInfoCard status={status} result={result} />,
    },
    [personaId, sessionOrders],
  );

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
        // Safety net (see docs/agent-contract.md): re-run compatibility against what the user
        // already owns, right here in the approval card, so a conflict surfaces
        // at the moment of approval even if the model's text missed it.
        const localCompat = checkCompatibility(items.map((item) => item.productId!), ownedRefs);
        const redundancy = localCompat.notes.filter((note) => note.includes("unnecessary"));
        return (
          <div className="agent-card">
            <h4>Add to cart?</h4>
            {args.reason && <div style={{ marginBottom: 8 }}>{args.reason}</div>}
            <ProductRows ids={products.map((p) => p.id)} />
            <div className="agent-total">Total {formatPrice(total)}</div>
            {localCompat.warnings.length > 0 && (
              <div className="agent-safety">
                <div className="agent-safety-head">
                  <AlertTriangle size={14} color="var(--warn)" /> Checked against what you own
                </div>
                <ul className="warning-list">
                  {localCompat.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            {redundancy.map((note) => (
              <div key={note} className="notice notice-warn" style={{ marginTop: 8 }}>
                {note}
              </div>
            ))}
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
    [shop.addToCart, ownedRefs],
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
