"use client";

import Link from "next/link";
import { CreditCard, MapPin, Package } from "lucide-react";
import { ordersForUser, returnEligibility, seedOrders } from "@/lib/orders";
import { formatDate, formatPrice, getProduct } from "@/lib/services";
import { personaOrder, userProfiles } from "@/lib/users";
import { useShop } from "@/lib/shop-context";
import type { OrderStatus, PersonaId, ReturnEligibility } from "@/lib/types";

const STATUS_LABEL: Record<OrderStatus, string> = {
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
};

function returnLine(eligibility: ReturnEligibility): { text: string; tone: "ok" | "warn" | "muted" } {
  switch (eligibility.status) {
    case "eligible":
      return {
        text: `Return window open until ${formatDate(eligibility.deadline!)}${
          eligibility.daysLeft != null ? ` · ${eligibility.daysLeft} days left` : ""
        }`,
        tone: "ok",
      };
    case "closed":
      return { text: "Return window closed", tone: "muted" };
    case "awaiting-delivery":
      return { text: "Arriving soon — return window opens on delivery", tone: "warn" };
    case "cancellable":
      return { text: "Processing — cancellable until it ships", tone: "warn" };
  }
}

function GuestPanel({ onPick }: { onPick: (id: PersonaId) => void }) {
  return (
    <div className="panel account-guest">
      <h1 className="page-title" style={{ marginTop: 0 }}>Your account</h1>
      <p className="page-tagline">
        You&apos;re browsing as a guest. Pick a demo account to see saved details, order history, and the
        assistant&apos;s memory in action.
      </p>
      <div className="account-persona-grid">
        {personaOrder.map((id) => {
          const profile = userProfiles[id];
          const count = ordersForUser(id).length;
          return (
            <button key={id} type="button" className="account-persona-card" onClick={() => onPick(id)}>
              <span className="account-persona-name">{profile.name}</span>
              <span className="account-persona-label">{profile.personaLabel}</span>
              <span className="account-persona-meta">
                {count === 0 ? "No orders yet" : `${count} order${count === 1 ? "" : "s"}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { personaId, activeUser, sessionOrders, setActiveUser } = useShop();

  if (!activeUser) {
    return <GuestPanel onPick={setActiveUser} />;
  }

  const orders = ordersForUser(personaId, [...sessionOrders, ...seedOrders]);
  const address = activeUser.savedAddress;

  return (
    <>
      <h1 className="page-title">Hi, {activeUser.name.split(" ")[0]}</h1>
      <p className="page-tagline">{activeUser.personaLabel}</p>

      <div className="account-grid">
        <div className="panel account-profile">
          <h3 style={{ marginTop: 0 }}>Profile</h3>
          <div className="account-row">
            <span className="account-row-label">Name</span>
            <span>{activeUser.name}</span>
          </div>
          <div className="account-row">
            <span className="account-row-label">Email</span>
            <span>{activeUser.email}</span>
          </div>
          <div className="account-row">
            <span className="account-row-label">
              <MapPin size={14} /> Address
            </span>
            <span>
              {address ? (
                <>
                  {address.address}
                  <br />
                  {address.postalCode} {address.city}, {address.country}
                </>
              ) : (
                <span className="muted-text">No saved address yet</span>
              )}
            </span>
          </div>
          <div className="account-row">
            <span className="account-row-label">
              <CreditCard size={14} /> Payment
            </span>
            <span style={{ textTransform: "capitalize" }}>{activeUser.preferredPayment ?? "—"}</span>
          </div>
        </div>

        <div className="account-orders">
          <h3 style={{ marginTop: 0 }}>Order history</h3>
          {orders.length === 0 ? (
            <div className="panel account-empty">
              <Package size={26} />
              <p>No orders yet. When you place one it&apos;ll show up here with its return window.</p>
              <Link href="/deals" className="btn btn-primary btn-sm">
                Browse today&apos;s deals
              </Link>
            </div>
          ) : (
            orders.map((order) => {
              const line = returnLine(returnEligibility(order));
              return (
                <div key={order.number} className="panel order-card">
                  <div className="order-card-head">
                    <div>
                      <span className="order-number">{order.number}</span>
                      <span className="order-date">Placed {formatDate(order.placedAt)}</span>
                    </div>
                    <span className={`status-chip status-${order.status}`}>{STATUS_LABEL[order.status]}</span>
                  </div>
                  <div className="order-items">
                    {order.lines.map((orderLine) => {
                      const product = getProduct(orderLine.productId);
                      return (
                        <div key={orderLine.productId} className="order-item">
                          <span>
                            {product?.name ?? orderLine.productId}
                            {orderLine.quantity > 1 ? ` × ${orderLine.quantity}` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="order-card-foot">
                    <span className={`return-line return-${line.tone}`}>{line.text}</span>
                    <span className="order-total">{formatPrice(order.total)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
