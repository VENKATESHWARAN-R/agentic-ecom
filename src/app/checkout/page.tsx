"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { CheckoutDetails } from "@/lib/types";
import { formatPrice, getProduct } from "@/lib/services";
import { useShop } from "@/lib/shop-context";

const PAYMENT_OPTIONS: { id: CheckoutDetails["paymentMethod"]; title: string; desc: string }[] = [
  { id: "card", title: "Card", desc: "Visa, Mastercard, Amex — mock payment, nothing is charged." },
  { id: "invoice", title: "Invoice", desc: "Pay within 14 days of delivery." },
  { id: "financing", title: "Financing", desc: "Split into 6–36 monthly installments." },
];

export default function CheckoutPage() {
  const { hydrated, cart, cartTotal, checkoutDraft, updateCheckoutDraft, placeOrder, lastOrder, activeUser, applySavedAddress } =
    useShop();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const emptyCart = hydrated && !cart.length && !lastOrder;

  useEffect(() => {
    if (emptyCart) router.replace("/cart");
  }, [emptyCart, router]);

  if (lastOrder && !cart.length) {
    return (
      <div className="order-confirm">
        <div className="check-circle">
          <CheckCircle2 size={30} />
        </div>
        <h1>Order confirmed</h1>
        <p className="page-tagline">
          Thanks, {lastOrder.details.fullName.split(" ")[0]}! Order <strong>{lastOrder.number}</strong> for{" "}
          <strong>{formatPrice(lastOrder.total)}</strong> is on its way to {lastOrder.details.address},{" "}
          {lastOrder.details.city}. A confirmation was “sent” to {lastOrder.details.email}. (Demo only — no
          real order was placed.)
        </p>
        <Link href="/" className="btn btn-primary">
          Back to the store
        </Link>
      </div>
    );
  }

  if (!cart.length) return null;

  const set = (key: keyof CheckoutDetails) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    updateCheckoutDraft({ [key]: event.target.value });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const required: (keyof CheckoutDetails)[] = ["fullName", "email", "address", "city", "postalCode", "country"];
    const missing = required.filter((key) => !checkoutDraft[key]?.toString().trim());
    if (missing.length) {
      setError("Please fill in all delivery fields before placing the order.");
      return;
    }
    setError(null);
    placeOrder(checkoutDraft as CheckoutDetails);
  };

  return (
    <>
      <h1 className="page-title">Checkout</h1>
      <p className="page-tagline">Demo checkout — no payment is processed.</p>
      <form className="two-col" onSubmit={submit}>
        <div>
          <div className="panel">
            <div className="panel-head">
              <h3 style={{ marginTop: 0, marginBottom: 0 }}>Delivery details</h3>
              {activeUser?.savedAddress && (
                <button type="button" className="btn btn-sm" onClick={() => applySavedAddress()}>
                  Use saved address
                </button>
              )}
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="fullName">Full name</label>
                <input id="fullName" value={checkoutDraft.fullName ?? ""} onChange={set("fullName")} placeholder="Aino Virtanen" />
              </div>
              <div className="form-field">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" value={checkoutDraft.email ?? ""} onChange={set("email")} placeholder="aino@example.com" />
              </div>
              <div className="form-field full">
                <label htmlFor="address">Street address</label>
                <input id="address" value={checkoutDraft.address ?? ""} onChange={set("address")} placeholder="Mannerheimintie 12 A 4" />
              </div>
              <div className="form-field">
                <label htmlFor="city">City</label>
                <input id="city" value={checkoutDraft.city ?? ""} onChange={set("city")} placeholder="Helsinki" />
              </div>
              <div className="form-field">
                <label htmlFor="postalCode">Postal code</label>
                <input id="postalCode" value={checkoutDraft.postalCode ?? ""} onChange={set("postalCode")} placeholder="00100" />
              </div>
              <div className="form-field full">
                <label htmlFor="country">Country</label>
                <select id="country" value={checkoutDraft.country ?? "Finland"} onChange={set("country")}>
                  {["Finland", "Sweden", "Norway", "Denmark", "Estonia", "Germany"].map((country) => (
                    <option key={country}>{country}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Payment</h3>
            <div className="pay-options">
              {PAYMENT_OPTIONS.map((option) => (
                <label key={option.id} className={`pay-option ${checkoutDraft.paymentMethod === option.id ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="payment"
                    value={option.id}
                    checked={checkoutDraft.paymentMethod === option.id}
                    onChange={() => updateCheckoutDraft({ paymentMethod: option.id })}
                  />
                  <span>
                    <span className="pay-title">{option.title}</span>
                    <br />
                    <span className="pay-desc">{option.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Order summary</h3>
          {cart.map((line) => {
            const product = getProduct(line.productId);
            if (!product) return null;
            return (
              <div key={line.productId} className="summary-row">
                <span>
                  {product.name} × {line.quantity}
                </span>
                <span>{formatPrice(product.price * line.quantity)}</span>
              </div>
            );
          })}
          <div className="summary-row">
            <span>Delivery</span>
            <span>Free</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{formatPrice(cartTotal)}</span>
          </div>
          {error && <div className="notice notice-warn">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 14 }}>
            Place order ({formatPrice(cartTotal)})
          </button>
        </div>
      </form>
    </>
  );
}
