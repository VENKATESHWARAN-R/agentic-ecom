"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, CheckoutDetails, Order } from "./types";
import { cartCount, cartTotal, getProduct } from "./services";

type ShopContextValue = {
  /** False until the cart has been restored from localStorage after mount. */
  hydrated: boolean;
  cart: CartLine[];
  cartTotal: number;
  cartCount: number;
  addToCart: (productId: string, quantity?: number) => boolean;
  removeFromCart: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;

  compareIds: string[];
  toggleCompare: (productId: string) => void;
  setCompareIds: (ids: string[]) => void;
  compareOpen: boolean;
  setCompareOpen: (open: boolean) => void;

  highlightedIds: string[];
  setHighlightedIds: (ids: string[]) => void;

  checkoutDraft: Partial<CheckoutDetails>;
  updateCheckoutDraft: (patch: Partial<CheckoutDetails>) => void;

  lastOrder: Order | null;
  placeOrder: (details: CheckoutDetails) => Order | null;
};

const ShopContext = createContext<ShopContextValue | null>(null);

const CART_KEY = "voltti.cart.v1";

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [checkoutDraft, setCheckoutDraft] = useState<Partial<CheckoutDetails>>({ country: "Finland", paymentMethod: "card" });
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CART_KEY);
      // One-time hydration from localStorage after mount (avoids SSR mismatch).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setCart(JSON.parse(stored));
    } catch {
      // ignore corrupted storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  const addToCart = useCallback((productId: string, quantity = 1) => {
    const product = getProduct(productId);
    if (!product || product.stock <= 0) return false;
    setCart((current) => {
      const existing = current.find((line) => line.productId === productId);
      if (existing) {
        return current.map((line) =>
          line.productId === productId ? { ...line, quantity: line.quantity + quantity } : line,
        );
      }
      return [...current, { productId, quantity }];
    });
    return true;
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((current) => current.filter((line) => line.productId !== productId));
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((current) =>
      current.map((line) => (line.productId === productId ? { ...line, quantity } : line)),
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleCompare = useCallback((productId: string) => {
    setCompareIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current.slice(-3), productId],
    );
  }, []);

  const updateCheckoutDraft = useCallback((patch: Partial<CheckoutDetails>) => {
    setCheckoutDraft((current) => ({ ...current, ...patch }));
  }, []);

  const placeOrder = useCallback(
    (details: CheckoutDetails) => {
      if (!cart.length) return null;
      const order: Order = {
        number: `VLT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
        lines: cart,
        total: cartTotal(cart),
        details,
        placedAt: new Date().toISOString(),
      };
      setLastOrder(order);
      setCart([]);
      return order;
    },
    [cart],
  );

  const value = useMemo<ShopContextValue>(
    () => ({
      hydrated,
      cart,
      cartTotal: cartTotal(cart),
      cartCount: cartCount(cart),
      addToCart,
      removeFromCart,
      setQuantity,
      clearCart,
      compareIds,
      toggleCompare,
      setCompareIds,
      compareOpen,
      setCompareOpen,
      highlightedIds,
      setHighlightedIds,
      checkoutDraft,
      updateCheckoutDraft,
      lastOrder,
      placeOrder,
    }),
    [hydrated, cart, addToCart, removeFromCart, setQuantity, clearCart, compareIds, toggleCompare, compareOpen, highlightedIds, checkoutDraft, updateCheckoutDraft, lastOrder, placeOrder],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) throw new Error("useShop must be used inside <ShopProvider>");
  return context;
}
