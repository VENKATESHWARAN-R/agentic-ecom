"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { formatPrice, getProduct } from "@/lib/services";
import { useShop } from "@/lib/shop-context";
import { ProductVisual } from "@/components/product-visual";

export default function CartPage() {
  const { cart, cartTotal, setQuantity, removeFromCart } = useShop();
  const router = useRouter();

  if (!cart.length) {
    return (
      <div className="order-confirm">
        <div className="check-circle">
          <ShoppingCart size={26} />
        </div>
        <h1>Your cart is empty</h1>
        <p className="page-tagline">
          Browse the catalog or ask the shopping assistant — try “find me a gaming PC under €1500”.
        </p>
        <Link href="/" className="btn btn-primary">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="page-title">Shopping cart</h1>
      <div className="two-col">
        <div className="panel">
          {cart.map((line) => {
            const product = getProduct(line.productId);
            if (!product) return null;
            return (
              <div key={line.productId} className="cart-line">
                <Link href={`/product/${product.id}`}>
                  <ProductVisual kind={product.visual} accent={product.accent} />
                </Link>
                <div>
                  <Link href={`/product/${product.id}`} className="cart-line-name">
                    {product.name}
                  </Link>
                  <div className="cart-line-meta">
                    {product.brand} · {formatPrice(product.price)} each
                    {product.stock <= 5 && product.stock > 0 && ` · only ${product.stock} in stock`}
                  </div>
                </div>
                <div className="cart-line-right">
                  <div className="qty-stepper">
                    <button onClick={() => setQuantity(line.productId, line.quantity - 1)} aria-label="Decrease">
                      −
                    </button>
                    <span>{line.quantity}</span>
                    <button onClick={() => setQuantity(line.productId, line.quantity + 1)} aria-label="Increase">
                      +
                    </button>
                  </div>
                  <strong>{formatPrice(product.price * line.quantity)}</strong>
                  <button className="link-button" onClick={() => removeFromCart(line.productId)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Summary</h3>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(cartTotal)}</span>
          </div>
          <div className="summary-row">
            <span>Delivery</span>
            <span>Free</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{formatPrice(cartTotal)}</span>
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={() => router.push("/checkout")}>
            Proceed to checkout
          </button>
          <Link href="/" className="btn btn-block" style={{ marginTop: 8 }}>
            Continue shopping
          </Link>
        </div>
      </div>
    </>
  );
}
