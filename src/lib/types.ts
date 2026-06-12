export type ProductCategory =
  | "phones"
  | "laptops"
  | "desktops"
  | "components"
  | "accessories"
  | "smart-home";

export type Product = {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  subcategory: string;
  price: number;
  originalPrice?: number;
  stock: number;
  rating: number;
  tags: string[];
  description: string;
  specs: Record<string, string | number | boolean>;
  compatibility?: {
    cpuSocket?: "AM5" | "LGA1700" | "LGA1851";
    motherboardSocket?: "AM5" | "LGA1700" | "LGA1851";
    memory?: "DDR4" | "DDR5";
    gpuLengthMm?: number;
    caseMaxGpuLengthMm?: number;
    psuWatts?: number;
    estimatedWatts?: number;
  };
  visual: "phone" | "laptop" | "desktop" | "chip" | "board" | "peripheral" | "home";
  accent: string;
};

export type CartLine = {
  productId: string;
  quantity: number;
};

export type ShoppingView = "home" | "offers" | "phones" | "gaming" | "components" | "cart" | "checkout";

export type ShoppingState = {
  goal?: "find_deals" | "gaming_setup" | "compare" | "checkout";
  currentPage: ShoppingView;
  filters: {
    category?: ProductCategory | "gaming";
    budget?: number;
    brand?: string[];
    dealOnly?: boolean;
    query?: string;
    useCase?: "gaming" | "camera" | "value" | "work";
  };
  shortlist: string[];
  comparison: {
    ids: string[];
    rationale?: string[];
  };
  recommendation?: {
    summary: string;
    tradeoffs: string[];
    totalPrice?: number;
    ids: string[];
    warnings: string[];
  };
  cartDraft: {
    ids: string[];
    total?: number;
  };
  pendingApproval?: {
    kind: "add_to_cart" | "checkout" | "address" | "upsell";
    payload: unknown;
  };
};

export type SearchFilters = {
  query?: string;
  category?: ProductCategory | "gaming";
  maxPrice?: number;
  brand?: string[];
  dealOnly?: boolean;
  inStockOnly?: boolean;
  tags?: string[];
};

export type GamingSetupRequest = {
  budget: number;
  games?: string[];
  brandPreference?: string[];
  includeMonitor?: boolean;
  preferLaptop?: boolean;
};
