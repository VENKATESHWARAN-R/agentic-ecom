// Seeded order history for the demo personas + the deterministic helpers that
// power returns answers, order pagination, and the derived owned-hardware
// profile. See docs/architecture.md.
//
// Dates are expressed as "N days ago" and materialized once at module load, so
// the demo always shows an open return window, a freshly closed one, and an
// in-transit order no matter when it runs. NOW is captured once for determinism
// within a process; derive displayed dates from the stored ISO strings.
import { cartTotal, getProduct } from "./services";
import type {
  CartLine,
  CheckoutDetails,
  Order,
  OrderStatus,
  OwnedPart,
  PersonaId,
  ReturnEligibility,
} from "./types";
import { getUserProfile } from "./users";

const DAY = 24 * 60 * 60 * 1000;
const RETURN_WINDOW_DAYS = 30;
const NOW = Date.now();

function isoDaysAgo(days: number) {
  return new Date(NOW - days * DAY).toISOString();
}

type SeedSpec = {
  number: string;
  userId: Exclude<PersonaId, "guest">;
  lines: CartLine[];
  placedDaysAgo: number;
  status: OrderStatus;
  deliveredDaysAgo?: number;
};

// Aino — the returns + cross-order-compat persona. Statuses chosen so every
// return state is demoable at once.
const ainoSpecs: SeedSpec[] = [
  {
    number: "VLT-1001",
    userId: "aino",
    placedDaysAgo: 38,
    status: "delivered",
    deliveredDaysAgo: 34, // window closed ~4 days ago
    lines: [
      { productId: "fractal-terra-itx", quantity: 1 },
      { productId: "bequiet-pure-power-12m-650", quantity: 1 },
    ],
  },
  {
    number: "VLT-1002",
    userId: "aino",
    placedDaysAgo: 16,
    status: "delivered",
    deliveredDaysAgo: 12, // ~18 days left
    lines: [
      { productId: "msi-b650-tomahawk", quantity: 1 },
      { productId: "corsair-vengeance-32gb-ddr5", quantity: 1 },
    ],
  },
  {
    number: "VLT-1003",
    userId: "aino",
    placedDaysAgo: 4,
    status: "shipped", // awaiting delivery — the in-transit 7800X3D
    lines: [{ productId: "ryzen-7-7800x3d", quantity: 1 }],
  },
];

// Sami — the context-discipline + fast-path persona. Three deliberate recent
// orders define his owned platform (LGA1700/DDR5, 365 mm case, 850 W PSU)…
const samiDeliberate: SeedSpec[] = [
  {
    number: "VLT-1004",
    userId: "sami",
    placedDaysAgo: 60,
    status: "delivered",
    deliveredDaysAgo: 56,
    lines: [
      { productId: "nzxt-h5-flow", quantity: 1 },
      { productId: "corsair-rm850e", quantity: 1 },
    ],
  },
  {
    number: "VLT-1005",
    userId: "sami",
    placedDaysAgo: 45,
    status: "delivered",
    deliveredDaysAgo: 41,
    lines: [
      { productId: "msi-z790-tomahawk", quantity: 1 },
      { productId: "core-i7-14700k", quantity: 1 },
    ],
  },
  {
    number: "VLT-1006",
    userId: "sami",
    placedDaysAgo: 20,
    status: "delivered",
    deliveredDaysAgo: 16,
    lines: [{ productId: "samsung-odyssey-g7-32", quantity: 1 }],
  },
];

// …plus a long tail of everyday purchases (phones/audio/accessories/storage —
// deliberately NONE in the six PC-part categories, so they never pollute the
// owned-hardware profile). This is the "many orders → tiny derived profile"
// context-discipline story.
const SAMI_POOL = [
  "airpods-pro-2",
  "sony-wh-1000xm5",
  "jbl-flip-6",
  "hyperx-cloud-iii",
  "logitech-mx-master-3s",
  "keychron-k8-pro",
  "anker-737-gan-charger",
  "echo-dot-5",
  "nest-hub-2",
  "tapo-p115-smart-plug",
  "iphone-16",
  "galaxy-s25",
  "pixel-9a",
  "nothing-phone-3a",
  "logitech-g-pro-x-superlight-2",
  "samsung-990-pro-2tb",
  "wd-black-sn770-1tb",
  "philips-hue-starter-kit",
  "razer-blackwidow-v4",
  "steelseries-arctis-nova-7",
];

const samiGenerated: SeedSpec[] = Array.from({ length: 25 }, (_, i) => {
  const placedDaysAgo = 80 + i * 18; // spread back ~18 months
  const lines: CartLine[] = [{ productId: SAMI_POOL[i % SAMI_POOL.length], quantity: 1 }];
  if (i % 4 === 0) lines.push({ productId: SAMI_POOL[(i + 7) % SAMI_POOL.length], quantity: 1 });
  return {
    number: `VLT-2${String(i + 1).padStart(3, "0")}`,
    userId: "sami",
    placedDaysAgo,
    status: "delivered",
    deliveredDaysAgo: placedDaysAgo - 4,
    lines,
  };
});

function buildOrder(spec: SeedSpec): Order {
  const profile = getUserProfile(spec.userId);
  const details: CheckoutDetails = {
    fullName: profile?.savedAddress?.fullName ?? profile?.name ?? "Customer",
    email: profile?.savedAddress?.email ?? profile?.email ?? "",
    address: profile?.savedAddress?.address ?? "",
    city: profile?.savedAddress?.city ?? "",
    postalCode: profile?.savedAddress?.postalCode ?? "",
    country: profile?.savedAddress?.country ?? "Finland",
    paymentMethod: profile?.preferredPayment ?? "card",
  };
  return {
    number: spec.number,
    userId: spec.userId,
    lines: spec.lines,
    total: cartTotal(spec.lines),
    details,
    placedAt: isoDaysAgo(spec.placedDaysAgo),
    status: spec.status,
    deliveredAt: spec.deliveredDaysAgo != null ? isoDaysAgo(spec.deliveredDaysAgo) : undefined,
  };
}

export const seedOrders: Order[] = [...ainoSpecs, ...samiDeliberate, ...samiGenerated].map(buildOrder);

/** A persona's orders, newest first. Accepts an override list so callers can merge session orders. */
export function ordersForUser(userId: PersonaId, all: Order[] = seedOrders): Order[] {
  return all
    .filter((order) => order.userId === userId)
    .sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt));
}

/**
 * 30-day free returns counted from delivery date — computed by code, never
 * reasoned by the model (see docs/agent-contract.md). The tool result carries the explicit
 * deadline; the prompt forbids the model from doing date math.
 */
export function returnEligibility(order: Order): ReturnEligibility {
  if (order.status === "processing") return { status: "cancellable" };
  if (order.status === "shipped") return { status: "awaiting-delivery" };
  const deliveredMs = order.deliveredAt ? Date.parse(order.deliveredAt) : Date.parse(order.placedAt);
  const deadlineMs = deliveredMs + RETURN_WINDOW_DAYS * DAY;
  if (NOW <= deadlineMs) {
    return {
      status: "eligible",
      deadline: new Date(deadlineMs).toISOString(),
      daysLeft: Math.ceil((deadlineMs - NOW) / DAY),
    };
  }
  return { status: "closed" };
}

export type OrderSummary = {
  number: string;
  placedAt: string;
  status: OrderStatus;
  total: number;
  /** Product names, max 3 then "+N more". */
  items: string[];
};

export type OrderLineDetail = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type OrderDetail = {
  number: string;
  placedAt: string;
  status: OrderStatus;
  deliveredAt?: string;
  total: number;
  lines: OrderLineDetail[];
  returnEligibility: ReturnEligibility;
};

function summarize(order: Order): OrderSummary {
  const names = order.lines.map((line) => getProduct(line.productId)?.name ?? line.productId);
  const items = names.length > 3 ? [...names.slice(0, 3), `+${names.length - 3} more`] : names;
  return { number: order.number, placedAt: order.placedAt, status: order.status, total: order.total, items };
}

/** Paginated compact summaries (default 5, max 20 per call) — pagination over bulk (see docs/architecture.md). */
export function getOrdersFor(
  userId: PersonaId,
  { limit = 5, offset = 0 }: { limit?: number; offset?: number } = {},
  all: Order[] = seedOrders,
): { total: number; orders: OrderSummary[] } {
  const orders = ordersForUser(userId, all);
  const clampedLimit = Math.max(1, Math.min(20, Math.floor(limit)));
  const clampedOffset = Math.max(0, Math.floor(offset));
  return {
    total: orders.length,
    orders: orders.slice(clampedOffset, clampedOffset + clampedLimit).map(summarize),
  };
}

export function getOrderDetail(
  userId: PersonaId,
  orderNumber: string,
  all: Order[] = seedOrders,
): OrderDetail | null {
  const order = ordersForUser(userId, all).find((candidate) => candidate.number === orderNumber);
  if (!order) return null;
  return {
    number: order.number,
    placedAt: order.placedAt,
    status: order.status,
    deliveredAt: order.deliveredAt,
    total: order.total,
    lines: order.lines.map((line) => {
      const product = getProduct(line.productId);
      return {
        productId: line.productId,
        name: product?.name ?? line.productId,
        quantity: line.quantity,
        unitPrice: product?.price ?? 0,
      };
    }),
    returnEligibility: returnEligibility(order),
  };
}

const OWNED_CATEGORIES: readonly string[] = ["motherboard", "cpu", "gpu", "ram", "psu", "case"];

/**
 * Derived, bounded profile of what the customer already owns: one entry per
 * PC-part category, newest purchase wins, max 6 (see docs/architecture.md). A customer with
 * 1,000 orders produces the same tiny profile as one with 3. Only delivered or
 * shipped orders count — a just-placed (processing) order isn't owned yet.
 */
export function ownedHardwareProfile(userId: PersonaId, all: Order[] = seedOrders): OwnedPart[] {
  const owned: OwnedPart[] = [];
  const seen = new Set<string>();
  for (const order of ordersForUser(userId, all)) {
    if (order.status === "processing") continue;
    for (const line of order.lines) {
      const product = getProduct(line.productId);
      if (!product) continue;
      const category = product.subcategory;
      if (!OWNED_CATEGORIES.includes(category) || seen.has(category)) continue;
      seen.add(category);
      owned.push({
        productId: product.id,
        category: category as OwnedPart["category"],
        orderNumber: order.number,
        orderedOn: order.placedAt,
        inTransit: order.status !== "delivered",
      });
      if (owned.length >= 6) return owned;
    }
  }
  return owned;
}
