"use client";

import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { checkCompatibility, formatPrice, getProducts, isDeal } from "@/lib/services";
import { useShop } from "@/lib/shop-context";
import { ProductVisual } from "./product-visual";
import { RatingStars } from "./product-card";

/** Floating tray shown while products are selected for comparison, plus the comparison modal. */
export function CompareTray() {
  const { compareIds, setCompareIds, compareOpen, setCompareOpen, addToCart } = useShop();
  const products = getProducts(compareIds);

  if (!products.length) return null;

  const hasPcParts = products.some((p) => p.compat);
  const compat = hasPcParts ? checkCompatibility(compareIds) : null;
  const specKeys = [...new Set(products.flatMap((p) => Object.keys(p.specs)))];

  return (
    <>
      {!compareOpen && (
        <div className="compare-tray">
          <span className="names">
            Comparing {products.length}: {products.map((p) => p.name).join(" · ")}
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => setCompareOpen(true)}>
            Compare
          </button>
          <button className="btn btn-sm" onClick={() => setCompareIds([])}>
            Clear
          </button>
        </div>
      )}

      {compareOpen && (
        <div className="compare-overlay" onClick={() => setCompareOpen(false)}>
          <div className="compare-modal" onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <h3>Compare products</h3>
                {compat && (
                  <div className={`notice ${compat.compatible ? "notice-ok" : "notice-warn"}`} style={{ margin: "8px 0 0" }}>
                    {compat.compatible ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    <div>
                      {compat.compatible
                        ? "No compatibility issues detected between these parts."
                        : compat.warnings.map((warning) => <div key={warning}>{warning}</div>)}
                    </div>
                  </div>
                )}
              </div>
              <button className="icon-btn" onClick={() => setCompareOpen(false)} aria-label="Close comparison">
                <X size={16} />
              </button>
            </div>

            <table className="compare-table">
              <thead>
                <tr>
                  <th className="row-label" />
                  {products.map((p) => (
                    <th key={p.id}>
                      <div style={{ width: 72 }}>
                        <ProductVisual kind={p.visual} accent={p.accent} />
                      </div>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="row-label">Price</td>
                  {products.map((p) => (
                    <td key={p.id}>
                      <strong>{formatPrice(p.price)}</strong>
                      {isDeal(p) && <span className="price-old" style={{ marginLeft: 6 }}>{formatPrice(p.originalPrice!)}</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="row-label">Rating</td>
                  {products.map((p) => (
                    <td key={p.id}>
                      <RatingStars rating={p.rating} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="row-label">Availability</td>
                  {products.map((p) => (
                    <td key={p.id}>{p.stock > 0 ? `In stock (${p.stock})` : "Out of stock"}</td>
                  ))}
                </tr>
                {specKeys.map((key) => (
                  <tr key={key}>
                    <td className="row-label">{key}</td>
                    {products.map((p) => (
                      <td key={p.id}>{p.specs[key] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="row-label" />
                  {products.map((p) => (
                    <td key={p.id}>
                      <button className="btn btn-primary btn-sm" disabled={p.stock <= 0} onClick={() => addToCart(p.id)}>
                        Add to cart
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
