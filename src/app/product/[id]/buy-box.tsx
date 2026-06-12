"use client";

import { useState } from "react";
import { Scale, ShoppingCart } from "lucide-react";
import type { Product } from "@/lib/types";
import { useShop } from "@/lib/shop-context";
import { PriceTag } from "@/components/product-card";

export function BuyBox({ product }: { product: Product }) {
  const { addToCart, toggleCompare, compareIds } = useShop();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const outOfStock = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const comparing = compareIds.includes(product.id);

  return (
    <div>
      <PriceTag product={product} large />
      <div className={`stock-note ${outOfStock ? "out" : lowStock ? "low" : "in"}`}>
        {outOfStock
          ? "Out of stock — check the alternatives below"
          : lowStock
            ? `Low stock — only ${product.stock} left`
            : `In stock (${product.stock} available) · Free delivery in 2–4 days`}
      </div>
      <div className="pdp-buy-row">
        <div className="qty-stepper">
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
            −
          </button>
          <span>{quantity}</span>
          <button onClick={() => setQuantity((q) => Math.min(product.stock || 1, q + 1))} aria-label="Increase quantity">
            +
          </button>
        </div>
        <button
          className="btn btn-primary"
          disabled={outOfStock}
          onClick={() => {
            if (addToCart(product.id, quantity)) {
              setAdded(true);
              setTimeout(() => setAdded(false), 1800);
            }
          }}
        >
          <ShoppingCart size={16} />
          {added ? "Added ✓" : outOfStock ? "Unavailable" : "Add to cart"}
        </button>
        <button className={`btn ${comparing ? "btn-primary" : ""}`} onClick={() => toggleCompare(product.id)}>
          <Scale size={16} />
          {comparing ? "In comparison" : "Compare"}
        </button>
      </div>
    </div>
  );
}
