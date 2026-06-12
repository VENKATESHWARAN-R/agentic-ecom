export type Category =
  | "phones"
  | "laptops"
  | "desktops"
  | "components"
  | "monitors"
  | "audio"
  | "accessories"
  | "smart-home";

export type VisualKind =
  | "phone"
  | "laptop"
  | "desktop"
  | "monitor"
  | "cpu"
  | "gpu"
  | "motherboard"
  | "ram"
  | "storage"
  | "psu"
  | "case"
  | "cooler"
  | "headset"
  | "earbuds"
  | "speaker"
  | "keyboard"
  | "mouse"
  | "charger"
  | "webcam"
  | "smart-home";

export type Socket = "AM5" | "AM4" | "LGA1700" | "LGA1851";
export type MemoryType = "DDR4" | "DDR5";

/** PC-part compatibility metadata. Only set the fields that apply to the part. */
export type Compat = {
  /** Socket of a CPU, or the socket a motherboard accepts. */
  socket?: Socket;
  /** Memory generation a CPU/motherboard/RAM kit uses. */
  memoryType?: MemoryType;
  /** Estimated power draw of a CPU or GPU in watts. */
  drawWatts?: number;
  /** Rated output of a PSU in watts. */
  psuWatts?: number;
  /** Physical length of a GPU in mm. */
  gpuLengthMm?: number;
  /** Maximum GPU length a case can fit in mm. */
  maxGpuLengthMm?: number;
};

export type Product = {
  /** kebab-case unique id, also used as the URL slug. */
  id: string;
  name: string;
  brand: string;
  category: Category;
  /** e.g. "cpu", "gaming-laptop", "ultrabook", "gaming-monitor", "anc-headphones" */
  subcategory: string;
  /** Current price in EUR. */
  price: number;
  /** If set (and higher than price), the product is on sale. */
  originalPrice?: number;
  /** 0 means out of stock. */
  stock: number;
  /** 3.5 – 5.0 */
  rating: number;
  reviewCount: number;
  /** lowercase keywords used by search, e.g. "gaming", "am5", "4k", "anc", "rgb" */
  tags: string[];
  /** One sentence shown on product cards. */
  blurb: string;
  /** 2-3 sentence paragraph shown on the product detail page. */
  description: string;
  /** 3-4 short selling points shown as bullets on the detail page. */
  highlights: string[];
  /** Ordered spec table for the detail page, e.g. { "Display": "6.3\" OLED, 120 Hz" } */
  specs: Record<string, string>;
  compat?: Compat;
  /** Drives the generated product illustration. */
  visual: VisualKind;
  /** Hex accent color for the illustration, e.g. "#4f6df5". */
  accent: string;
};

export type CartLine = {
  productId: string;
  quantity: number;
};

export type CheckoutDetails = {
  fullName: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  paymentMethod: "card" | "invoice" | "financing";
};

export type Order = {
  number: string;
  lines: CartLine[];
  total: number;
  details: CheckoutDetails;
  placedAt: string;
};

export type SortOption = "relevance" | "price-asc" | "price-desc" | "rating";

export type SearchFilters = {
  query?: string;
  category?: Category | "gaming";
  maxPrice?: number;
  minPrice?: number;
  brands?: string[];
  dealsOnly?: boolean;
  inStockOnly?: boolean;
  tags?: string[];
  sort?: SortOption;
};

export type PcBuildRequest = {
  budget: number;
  /** "amd" | "intel" | undefined (no preference) */
  cpuPlatform?: "amd" | "intel";
  /** e.g. ["nvidia"] or specific brands the user asked for */
  brandPreference?: string[];
  /** Games or genres the user plans to play. */
  games?: string[];
};

export type GamingSetupRequest = {
  budget: number;
  games?: string[];
  brandPreference?: string[];
  includeMonitor?: boolean;
  includePeripherals?: boolean;
  preferLaptop?: boolean;
};

export type CompatibilityResult = {
  productIds: string[];
  compatible: boolean;
  warnings: string[];
  notes: string[];
};
