"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CopilotSidebar,
  useAgentContext,
  useFrontendTool,
  useHumanInTheLoop,
} from "@copilotkit/react-core/v2";
import type { JsonSerializable } from "@copilotkit/react-core/v2";
import {
  AlertTriangle,
  BadgeEuro,
  Check,
  ChevronRight,
  Cpu,
  Filter,
  Gamepad2,
  Heart,
  Home,
  Monitor,
  PackageCheck,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { z } from "zod";
import { featuredIds, products } from "@/lib/catalog";
import { cartTotal, checkCompatibility, formatPrice, getProducts, recommendGamingSetup, searchProducts } from "@/lib/services";
import type { CartLine, Product, ShoppingState, ShoppingView } from "@/lib/types";

type ModelContextNavigator = Navigator & {
  modelContext?: {
    registerTool?: (tool: unknown) => void | Promise<void>;
  };
};

const initialShoppingState: ShoppingState = {
  currentPage: "home",
  filters: {},
  shortlist: [],
  comparison: { ids: [] },
  cartDraft: { ids: [] },
};

const navItems: { id: ShoppingView; label: string; icon: React.ElementType }[] = [
  { id: "home", label: "Store", icon: Home },
  { id: "offers", label: "Offers", icon: BadgeEuro },
  { id: "phones", label: "Phones", icon: Monitor },
  { id: "gaming", label: "Gaming", icon: Gamepad2 },
  { id: "components", label: "Parts", icon: Cpu },
  { id: "cart", label: "Cart", icon: ShoppingCart },
];

export function CommerceExperience() {
  const [state, setState] = useState<ShoppingState>(initialShoppingState);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [checkoutConfirmed, setCheckoutConfirmed] = useState(false);

  const cartProducts = useMemo(() => getProducts(cart.map((line) => line.productId)), [cart]);
  const total = useMemo(() => cartTotal(cart), [cart]);

  const visibleProducts = useMemo(() => {
    if (state.currentPage === "cart" || state.currentPage === "checkout") return cartProducts;
    const category =
      state.currentPage === "phones"
        ? "phones"
        : state.currentPage === "gaming"
          ? "gaming"
          : state.currentPage === "components"
            ? "components"
            : state.filters.category;

    return searchProducts({
      query: searchText || state.filters.query,
      category,
      maxPrice: state.filters.budget,
      brand: state.filters.brand,
      dealOnly: state.currentPage === "offers" || state.filters.dealOnly,
    });
  }, [cartProducts, searchText, state.currentPage, state.filters]);

  const comparison = useMemo(() => checkCompatibility(selectedIds), [selectedIds]);
  const deals = useMemo(() => products.filter((product) => product.originalPrice), []);
  const featured = useMemo(() => getProducts(featuredIds), []);

  useAgentContext({
    description: "Current storefront state, cart, shortlist, selected comparison products, and visible products.",
    value: toJson({
      currentPage: state.currentPage,
      filters: state.filters,
      shortlist: state.shortlist,
      cart,
      cartTotal: total,
      selectedIds,
      visibleProducts: visibleProducts.slice(0, 8).map(productContext),
      compatibility: { compatible: comparison.compatible, warnings: comparison.warnings },
    }),
  });

  useFrontendTool({
    name: "navigateToPage",
    description: "Navigate the storefront to a top-level page.",
    parameters: z.object({
      page: z.enum(["home", "offers", "phones", "gaming", "components", "cart", "checkout"]),
    }),
    handler: async ({ page }) => {
      setState((current) => ({ ...current, currentPage: page }));
      return `Navigated to ${page}.`;
    },
  });

  useFrontendTool({
    name: "applyProductFilters",
    description: "Apply catalog filters in the storefront UI.",
    parameters: z.object({
      query: z.string().optional(),
      category: z.enum(["phones", "laptops", "desktops", "components", "accessories", "smart-home", "gaming"]).optional(),
      budget: z.number().optional(),
      dealOnly: z.boolean().optional(),
    }),
    handler: async ({ query, category, budget, dealOnly }) => {
      setSearchText(query ?? "");
      setState((current) => ({
        ...current,
        currentPage: category === "gaming" ? "gaming" : category === "phones" ? "phones" : dealOnly ? "offers" : current.currentPage,
        filters: { ...current.filters, query, category, budget, dealOnly },
      }));
      return `Applied filters for ${query ?? category ?? "all products"}.`;
    },
  });

  useFrontendTool({
    name: "highlightProducts",
    description: "Highlight products in the grid by product id.",
    parameters: z.object({
      productIds: z.array(z.string()),
    }),
    handler: async ({ productIds }) => {
      setSelectedIds(productIds);
      return `Highlighted ${productIds.length} products.`;
    },
  });

  useFrontendTool({
    name: "openComparison",
    description: "Open a product comparison and show any compatibility warnings.",
    parameters: z.object({
      productIds: z.array(z.string()),
      rationale: z.array(z.string()).optional(),
    }),
    handler: async ({ productIds, rationale }) => {
      setSelectedIds(productIds);
      setState((current) => ({
        ...current,
        goal: "compare",
        comparison: { ids: productIds, rationale },
      }));
      return checkCompatibility(productIds);
    },
  });

  useFrontendTool({
    name: "draftCart",
    description: "Prepare a cart draft for the user to review before adding products.",
    parameters: z.object({
      productIds: z.array(z.string()),
      summary: z.string().optional(),
    }),
    handler: async ({ productIds, summary }) => {
      const draftProducts = getProducts(productIds);
      setState((current) => ({
        ...current,
        goal: "checkout",
        currentPage: "cart",
        cartDraft: { ids: productIds, total: draftProducts.reduce((sum, product) => sum + product.price, 0) },
        pendingApproval: { kind: "add_to_cart", payload: { productIds, summary } },
      }));
      return `Prepared a cart draft with ${draftProducts.length} items. User confirmation is still required.`;
    },
  });

  useHumanInTheLoop(
    {
      name: "confirmCartDraft",
      description: "Ask the shopper to confirm a cart draft before adding items to cart.",
      parameters: z.object({
        productIds: z.array(z.string()),
        message: z.string(),
      }),
      render: ({ args, respond }) => {
        const productIds = args.productIds ?? [];
        return (
        <div className="hitl-card">
          <strong>Approve cart update?</strong>
          <p>{args.message}</p>
          <div className="hitl-products">
            {getProducts(productIds).map((product) => (
              <span key={product.id}>{product.name}</span>
            ))}
          </div>
          <div className="hitl-actions">
            <button onClick={() => respond?.({ approved: false })}>Skip</button>
            <button
              className="primary"
              onClick={() => {
                addManyToCart(productIds);
                respond?.({ approved: true, added: productIds });
              }}
            >
              Add to cart
            </button>
          </div>
        </div>
        );
      },
    },
    [],
  );

  useEffect(() => {
    registerWebMcpTools({
      onNavigate: (page) => setState((current) => ({ ...current, currentPage: page })),
      onSearch: (query) => setSearchText(query),
      onAddToCart: (productId) => addToCart(productId),
    });
  }, []);

  function addToCart(productId: string) {
    setCart((current) => {
      const existing = current.find((line) => line.productId === productId);
      if (existing) {
        return current.map((line) => (line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [...current, { productId, quantity: 1 }];
    });
  }

  function addManyToCart(productIds: string[]) {
    productIds.forEach(addToCart);
    setState((current) => ({ ...current, pendingApproval: undefined, cartDraft: { ids: [] }, currentPage: "cart" }));
  }

  function removeFromCart(productId: string) {
    setCart((current) => current.filter((line) => line.productId !== productId));
  }

  function toggleShortlist(productId: string) {
    setState((current) => ({
      ...current,
      shortlist: current.shortlist.includes(productId)
        ? current.shortlist.filter((id) => id !== productId)
        : [...current.shortlist, productId],
    }));
  }

  function runGamingAdvisor() {
    const recommendation = recommendGamingSetup({ budget: state.filters.budget ?? 1500, games: ["Valorant", "CS2", "AAA games"], includeMonitor: true });
    setSelectedIds(recommendation.ids);
    setState((current) => ({
      ...current,
      goal: "gaming_setup",
      currentPage: "gaming",
      recommendation: {
        ids: recommendation.ids,
        summary: recommendation.summary,
        tradeoffs: recommendation.tradeoffs,
        totalPrice: recommendation.totalPrice,
        warnings: recommendation.warnings,
      },
    }));
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <div>
            <strong>SignalCart</strong>
            <small>Agentic electronics commerce POC</small>
          </div>
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={state.currentPage === item.id ? "active" : ""}
              onClick={() => setState((current) => ({ ...current, currentPage: item.id }))}
              title={item.label}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <section className="hero-band">
        <div className="hero-copy">
          <p className="eyebrow">CopilotKit powered shopping</p>
          <h1>Find the right device, build the right setup, and keep the basket human-approved.</h1>
          <div className="hero-actions">
            <button className="primary-action" onClick={runGamingAdvisor}>
              <Sparkles size={18} />
              Build gaming setup
            </button>
            <button className="ghost-action" onClick={() => setState((current) => ({ ...current, currentPage: "offers" }))}>
              <BadgeEuro size={18} />
              View offers
            </button>
          </div>
        </div>
        <div className="hero-stage" aria-hidden="true">
          <div className="device-showcase tower" />
          <div className="device-showcase phone" />
          <div className="device-showcase laptop" />
        </div>
      </section>

      <section className="workbench">
        <aside className="left-rail">
          <div className="search-box">
            <Search size={18} />
            <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search phones, RTX, AM5..." />
          </div>

          <div className="filter-group">
            <div className="rail-heading">
              <Filter size={16} />
              <span>Quick filters</span>
            </div>
            {[
              ["Deals", "offers"],
              ["Gaming", "gaming"],
              ["Phones", "phones"],
              ["Components", "components"],
            ].map(([label, page]) => (
              <button key={page} onClick={() => setState((current) => ({ ...current, currentPage: page as ShoppingView }))}>
                {label}
                <ChevronRight size={15} />
              </button>
            ))}
          </div>

          <div className="budget-box">
            <div className="rail-heading">
              <SlidersHorizontal size={16} />
              <span>Budget</span>
            </div>
            <input
              type="range"
              min={250}
              max={2200}
              step={50}
              value={state.filters.budget ?? 1500}
              onChange={(event) =>
                setState((current) => ({ ...current, filters: { ...current.filters, budget: Number(event.target.value) } }))
              }
            />
            <strong>{formatPrice(state.filters.budget ?? 1500)}</strong>
          </div>

          <RecommendationPanel state={state} onDraft={addManyToCart} />
        </aside>

        <section className="catalog-area">
          <div className="section-head">
            <div>
              <p>{state.currentPage}</p>
              <h2>{headlineFor(state.currentPage)}</h2>
            </div>
            <span>{visibleProducts.length} items</span>
          </div>

          {state.currentPage === "cart" ? (
            <CartView products={cartProducts} total={total} removeFromCart={removeFromCart} onCheckout={() => setState((current) => ({ ...current, currentPage: "checkout" }))} />
          ) : state.currentPage === "checkout" ? (
            <CheckoutView products={cartProducts} total={total} confirmed={checkoutConfirmed} onConfirm={() => setCheckoutConfirmed(true)} />
          ) : (
            <ProductGrid
              products={visibleProducts.length ? visibleProducts : featured}
              selectedIds={selectedIds}
              shortlist={state.shortlist}
              onSelect={(productId) => setSelectedIds((current) => (current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]))}
              onAdd={addToCart}
              onShortlist={toggleShortlist}
            />
          )}
        </section>

        <aside className="right-rail">
          <ComparisonPanel selectedIds={selectedIds} comparison={comparison} />
          <CartSummary cart={cart} total={total} products={cartProducts} onOpen={() => setState((current) => ({ ...current, currentPage: "cart" }))} />
          <DealsPanel deals={deals.slice(0, 3)} />
        </aside>
      </section>

      <CopilotSidebar
        agentId="default"
        defaultOpen={false}
        labels={{
          modalHeaderTitle: "SignalCart Copilot",
          welcomeMessageText: "Tell me what you are shopping for. I can search the catalog, compare products, draft a cart, and flag PC compatibility issues.",
          chatInputPlaceholder: "Ask for deals, builds, compatibility, or checkout help...",
        }}
      />
    </main>
  );
}

function ProductGrid({
  products,
  selectedIds,
  shortlist,
  onSelect,
  onAdd,
  onShortlist,
}: {
  products: Product[];
  selectedIds: string[];
  shortlist: string[];
  onSelect: (productId: string) => void;
  onAdd: (productId: string) => void;
  onShortlist: (productId: string) => void;
}) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <article key={product.id} className={`product-card ${selectedIds.includes(product.id) ? "selected" : ""}`}>
          <ProductVisual product={product} />
          <div className="product-body">
            <div className="product-meta">
              <span>{product.brand}</span>
              {product.originalPrice ? <b>Save {formatPrice(product.originalPrice - product.price)}</b> : null}
            </div>
            <h3>{product.name}</h3>
            <p>{product.description}</p>
            <div className="spec-list">
              {Object.entries(product.specs)
                .slice(0, 3)
                .map(([key, value]) => (
                  <span key={key}>
                    {key}: {String(value)}
                  </span>
                ))}
            </div>
          </div>
          <div className="product-foot">
            <div>
              <strong>{formatPrice(product.price)}</strong>
              {product.originalPrice ? <small>{formatPrice(product.originalPrice)}</small> : null}
            </div>
            <div className="icon-actions">
              <button title="Shortlist" className={shortlist.includes(product.id) ? "on" : ""} onClick={() => onShortlist(product.id)}>
                <Heart size={17} />
              </button>
              <button title="Compare" className={selectedIds.includes(product.id) ? "on" : ""} onClick={() => onSelect(product.id)}>
                <SlidersHorizontal size={17} />
              </button>
              <button title="Add to cart" disabled={product.stock === 0} onClick={() => onAdd(product.id)}>
                <ShoppingCart size={17} />
              </button>
            </div>
          </div>
          <span className={`stock ${product.stock > 0 ? "in" : "out"}`}>{product.stock > 0 ? `${product.stock} in stock` : "Unavailable"}</span>
        </article>
      ))}
    </div>
  );
}

function ProductVisual({ product }: { product: Product }) {
  return (
    <div className={`product-visual ${product.visual}`} style={{ "--accent": product.accent } as React.CSSProperties}>
      <span />
    </div>
  );
}

function RecommendationPanel({ state, onDraft }: { state: ShoppingState; onDraft: (ids: string[]) => void }) {
  if (!state.recommendation) {
    return (
      <div className="insight-panel">
        <Sparkles size={18} />
        <strong>Advisor ready</strong>
        <p>Ask for a gaming PC, a discounted phone, or a compatibility check. The UI updates as the agent works.</p>
      </div>
    );
  }

  return (
    <div className="insight-panel active">
      <Sparkles size={18} />
      <strong>{state.recommendation.summary}</strong>
      <ul>
        {state.recommendation.tradeoffs.map((tradeoff) => (
          <li key={tradeoff}>{tradeoff}</li>
        ))}
      </ul>
      {state.recommendation.warnings.map((warning) => (
        <p className="warning" key={warning}>
          {warning}
        </p>
      ))}
      <button onClick={() => onDraft(state.recommendation?.ids ?? [])}>Draft this cart</button>
    </div>
  );
}

function ComparisonPanel({ selectedIds, comparison }: { selectedIds: string[]; comparison: ReturnType<typeof checkCompatibility> }) {
  return (
    <div className="side-panel">
      <div className="panel-title">
        <Cpu size={17} />
        <strong>Compatibility</strong>
      </div>
      {selectedIds.length === 0 ? (
        <p>Select products or ask the copilot to compare a build.</p>
      ) : comparison.compatible ? (
        <p className="ok">
          <Check size={16} /> No compatibility issues found.
        </p>
      ) : (
        <div className="warning-list">
          {comparison.warnings.map((warning) => (
            <p key={warning}>
              <AlertTriangle size={16} />
              {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function CartSummary({ cart, total, products, onOpen }: { cart: CartLine[]; total: number; products: Product[]; onOpen: () => void }) {
  return (
    <div className="side-panel">
      <div className="panel-title">
        <ShoppingCart size={17} />
        <strong>Cart</strong>
      </div>
      {products.length ? (
        <div className="mini-cart">
          {products.slice(0, 3).map((product) => (
            <span key={product.id}>{product.name}</span>
          ))}
          <strong>{formatPrice(total)}</strong>
        </div>
      ) : (
        <p>No items yet.</p>
      )}
      <button onClick={onOpen}>Review cart ({cart.length})</button>
    </div>
  );
}

function DealsPanel({ deals }: { deals: Product[] }) {
  return (
    <div className="side-panel">
      <div className="panel-title">
        <BadgeEuro size={17} />
        <strong>Live deals</strong>
      </div>
      {deals.map((deal) => (
        <div className="deal-row" key={deal.id}>
          <span>{deal.name}</span>
          <b>{formatPrice(deal.price)}</b>
        </div>
      ))}
    </div>
  );
}

function CartView({ products, total, removeFromCart, onCheckout }: { products: Product[]; total: number; removeFromCart: (id: string) => void; onCheckout: () => void }) {
  if (!products.length) {
    return <div className="empty-state">Your cart is empty. Ask the copilot to draft a setup or add products from the grid.</div>;
  }

  return (
    <div className="cart-view">
      {products.map((product) => (
        <div className="cart-line" key={product.id}>
          <ProductVisual product={product} />
          <div>
            <strong>{product.name}</strong>
            <span>{product.brand}</span>
          </div>
          <b>{formatPrice(product.price)}</b>
          <button title="Remove" onClick={() => removeFromCart(product.id)}>
            <Trash2 size={17} />
          </button>
        </div>
      ))}
      <div className="cart-total">
        <span>Total</span>
        <strong>{formatPrice(total)}</strong>
        <button onClick={onCheckout}>Continue to mock checkout</button>
      </div>
    </div>
  );
}

function CheckoutView({ products, total, confirmed, onConfirm }: { products: Product[]; total: number; confirmed: boolean; onConfirm: () => void }) {
  return (
    <div className="checkout-view">
      <PackageCheck size={34} />
      <h2>Mock checkout review</h2>
      <p>Orders are never submitted automatically. This POC stops at human approval.</p>
      <div className="checkout-lines">
        {products.map((product) => (
          <span key={product.id}>
            {product.name} <b>{formatPrice(product.price)}</b>
          </span>
        ))}
      </div>
      <strong>{formatPrice(total)}</strong>
      <button className={confirmed ? "confirmed" : ""} onClick={onConfirm}>
        {confirmed ? "Approved for demo" : "Approve mock order"}
      </button>
    </div>
  );
}

function headlineFor(page: ShoppingView) {
  const labels: Record<ShoppingView, string> = {
    home: "Featured electronics",
    offers: "Discounted devices",
    phones: "Phones and 5G devices",
    gaming: "Gaming setups and accessories",
    components: "PC components",
    cart: "Cart review",
    checkout: "Human-approved checkout",
  };
  return labels[page];
}

function productContext(product: Product) {
  return toJson({
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    subcategory: product.subcategory,
    price: product.price,
    stock: product.stock,
    tags: product.tags,
    specs: product.specs,
    compatibility: product.compatibility,
  });
}

function toJson(value: unknown): JsonSerializable {
  return JSON.parse(JSON.stringify(value)) as JsonSerializable;
}

function registerWebMcpTools({
  onNavigate,
  onSearch,
  onAddToCart,
}: {
  onNavigate: (page: ShoppingView) => void;
  onSearch: (query: string) => void;
  onAddToCart: (productId: string) => void;
}) {
  const api = (navigator as ModelContextNavigator).modelContext;
  if (!api?.registerTool) return;

  void api.registerTool({
    name: "search_catalog",
    description: "Search the visible SignalCart catalog by natural language query.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Search phrase such as discounted phones or AM5 motherboard." } },
      required: ["query"],
    },
    execute: ({ query }: { query: string }) => {
      onSearch(query);
      return searchProducts({ query, inStockOnly: false }).slice(0, 5).map(productContext);
    },
  });

  void api.registerTool({
    name: "navigate_storefront",
    description: "Navigate SignalCart to a main storefront page.",
    inputSchema: {
      type: "object",
      properties: { page: { type: "string", enum: ["home", "offers", "phones", "gaming", "components", "cart", "checkout"] } },
      required: ["page"],
    },
    execute: ({ page }: { page: ShoppingView }) => {
      onNavigate(page);
      return { page };
    },
  });

  void api.registerTool({
    name: "add_product_to_cart",
    description: "Add one in-stock product to the cart. Checkout still requires human approval.",
    inputSchema: {
      type: "object",
      properties: { productId: { type: "string", description: "SignalCart product id." } },
      required: ["productId"],
    },
    execute: ({ productId }: { productId: string }) => {
      onAddToCart(productId);
      return { added: productId, checkoutRequiresApproval: true };
    },
  });
}
