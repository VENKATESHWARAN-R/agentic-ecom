// Typed client for the backend's REST API, called through the same-origin BFF
// proxy (src/app/api/bff). The Next server attaches the signed identity assertion
// and forwards to the backend — the browser never calls the backend directly and
// holds no backend URL (P4, see docs/target-architecture.md). The proxy maps
// /api/bff/<x> → <backend>/api/<x>, so paths below are written without /api.
import type { CartLine, CheckoutDetails, Order, OrderStatus, PersonaId, ReturnEligibility } from "./types";

/** Same-origin BFF prefix. */
const BFF = "/api/bff";

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
  policy?: string;
};

export type PersonaSummary = {
  id: Exclude<PersonaId, "guest">;
  name: string;
  personaLabel: string;
  ordersTotal: number;
};

/** One owned PC part, enriched with the compat facts the agent context needs. */
export type OwnedHardwareEntry = {
  productId: string;
  category: string;
  socket: string | null;
  memoryType: string | null;
  wifi: boolean;
  orderNumber: string;
  orderedOn: string;
  inTransit: boolean;
};

export type AgentProfile = {
  ordersTotal: number;
  ownedHardware: OwnedHardwareEntry[];
  ownedRefs: { productId: string; orderNumber: string; orderedOn: string }[];
};

const EMPTY_AGENT_PROFILE: AgentProfile = { ordersTotal: 0, ownedHardware: [], ownedRefs: [] };

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BFF}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Backend request failed: ${path} → ${response.status}`);
  return response.json();
}

export function fetchPersonas(): Promise<PersonaSummary[]> {
  return getJson("/users");
}

export function fetchAgentProfile(personaId: PersonaId): Promise<AgentProfile> {
  if (personaId === "guest") return Promise.resolve(EMPTY_AGENT_PROFILE);
  return getJson(`/users/${personaId}/agent-profile`);
}

export function fetchOrders(personaId: PersonaId): Promise<OrderDetail[]> {
  if (personaId === "guest") return Promise.resolve([]);
  return getJson(`/users/${personaId}/orders`);
}

export function fetchOrderSummaries(
  personaId: PersonaId,
  { limit = 5, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<{ total: number; offset: number; returned: number; orders: OrderSummary[] }> {
  return getJson(`/users/${personaId}/orders/summaries?limit=${limit}&offset=${offset}`);
}

export async function fetchOrderDetail(personaId: PersonaId, orderNumber: string): Promise<OrderDetail | null> {
  const response = await fetch(
    `${BFF}/users/${personaId}/orders/${encodeURIComponent(orderNumber)}`,
    { cache: "no-store" },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Backend request failed: ${response.status}`);
  return response.json();
}

export async function placeOrderApi(lines: CartLine[], details: CheckoutDetails): Promise<Order> {
  // Identity comes from the BFF session server-side; the body carries no userId,
  // so the browser cannot place an order as someone else (P4).
  const response = await fetch(`${BFF}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines, details }),
  });
  if (!response.ok) throw new Error(`Order placement failed: ${response.status}`);
  return response.json();
}
