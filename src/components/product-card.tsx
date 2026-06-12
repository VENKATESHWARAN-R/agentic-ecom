"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Scale, ShoppingCart } from "lucide-react";
import type { Product } from "@/lib/types";
import { discountPercent, formatPrice, isDeal } from "@/lib/services";
import { useShop } from "@/lib/shop-context";
import { ProductVisual } from "./product-visual";

export function RatingStars({ rating, count }: { rating: number; count?: number }) {
  const full = Math.round(rating);
  return (
    <span className="rating">
      <span className="stars" aria-label={`${rating} out of 5`}>
        {"★".repeat(full)}
        {"☆".repeat(5 - full)}
      </span>
      {rating.toFixed(1)}
      {count !== undefined && <span>({count})</span>}
    </span>
  );
}

export function PriceTag({ product, large }: { product: Product; large?: boolean }) {
  const deal = isDeal(product);
  return (
    <div className={large ? "pdp-price-box" : "price-row"}>
      <span className={`price ${deal ? "deal" : ""}`}>{formatPrice(product.price)}</span>
      {deal && <span className="price-old">{formatPrice(product.originalPrice!)}</span>}
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleCompare, compareIds, highlightedIds } = useShop();
  const highlighted = highlightedIds.includes(product.id);
  const comparing = compareIds.includes(product.id);
  const outOfStock = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted && highlightedIds[0] === product.id) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted, highlightedIds, product.id]);

  return (
    <div ref={ref} className={`product-card ${highlighted ? "highlighted" : ""}`}>
      <div className="card-badges">
        {isDeal(product) && <span className="badge badge-deal">-{discountPercent(product)}%</span>}
        {outOfStock && <span className="badge badge-oos">Out of stock</span>}
        {lowStock && <span className="badge badge-low">Only {product.stock} left</span>}
      </div>
      <Link href={`/product/${product.id}`}>
        <ProductVisual kind={product.visual} accent={product.accent} />
        <div className="card-brand">{product.brand}</div>
        <div className="card-name">{product.name}</div>
        <p className="card-blurb">{product.blurb}</p>
        <RatingStars rating={product.rating} count={product.reviewCount} />
        <PriceTag product={product} />
      </Link>
      <div className="card-actions">
        <button
          className="btn btn-primary btn-sm"
          disabled={outOfStock}
          onClick={() => addToCart(product.id)}
        >
          <ShoppingCart size={15} />
          {outOfStock ? "Unavailable" : "Add to cart"}
        </button>
        <button
          className={`icon-btn ${comparing ? "active" : ""}`}
          title={comparing ? "Remove from comparison" : "Add to comparison"}
          onClick={() => toggleCompare(product.id)}
        >
          <Scale size={15} />
        </button>
      </div>
    </div>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  if (!products.length) {
    return <div className="empty-state">No products match these filters. Try widening the search.</div>;
  }
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
