"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, CheckoutDetails, Order, PersonaId, UserProfile } from "./types";
import { cartCount, cartTotal, getProduct } from "./services";
import { getUserProfile, isPersonaId } from "./users";

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
  /** Copies the active persona's saved address into the checkout draft. Returns false if there's none. */
  applySavedAddress: () => boolean;

  /** Active demo persona. "guest" = signed out. Identity is never model-supplied (see docs/architecture.md). */
  personaId: PersonaId;
  activeUser: UserProfile | null;
  setActiveUser: (id: PersonaId) => void;

  /** Orders placed during this session (all personas, newest first). Merged with seed in /account & tools. */
  sessionOrders: Order[];

  lastOrder: Order | null;
  placeOrder: (details: CheckoutDetails) => Order | null;
};

const ShopContext = createContext<ShopContextValue | null>(null);

const CART_KEY = "voltti.cart.v1";
const USER_KEY = "voltti.user.v1";
const SESSION_ORDERS_KEY = "voltti.session-orders.v1";

/** Non-PII checkout defaults for a persona (payment + country only — the address is applied explicitly). */
function personaCheckoutDefaults(user: UserProfile | null): Partial<CheckoutDetails> {
  return {
    country: user?.savedAddress?.country ?? "Finland",
    paymentMethod: user?.preferredPayment ?? "card",
  };
}

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [checkoutDraft, setCheckoutDraft] = useState<Partial<CheckoutDetails>>({ country: "Finland", paymentMethod: "card" });
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [personaId, setPersonaId] = useState<PersonaId>("guest");
  const [sessionOrders, setSessionOrders] = useState<Order[]>([]);

  const activeUser = useMemo(() => getUserProfile(personaId), [personaId]);

  useEffect(() => {
    // One-time hydration from localStorage after mount (avoids SSR mismatch).
    /* eslint-disable react-hooks/set-state-in-effect -- intentional one-time hydration */
    try {
      const storedCart = window.localStorage.getItem(CART_KEY);
      if (storedCart) setCart(JSON.parse(storedCart));
      const storedUser = window.localStorage.getItem(USER_KEY);
      if (storedUser && isPersonaId(storedUser)) {
        setPersonaId(storedUser);
        setCheckoutDraft((current) => ({ ...current, ...personaCheckoutDefaults(getUserProfile(storedUser)) }));
      }
      const storedOrders = window.localStorage.getItem(SESSION_ORDERS_KEY);
      if (storedOrders) setSessionOrders(JSON.parse(storedOrders));
    } catch {
      // ignore corrupted storage
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(USER_KEY, personaId);
  }, [personaId, hydrated]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(SESSION_ORDERS_KEY, JSON.stringify(sessionOrders));
  }, [sessionOrders, hydrated]);

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

  const applySavedAddress = useCallback(() => {
    const user = getUserProfile(personaId);
    if (!user?.savedAddress) return false;
    setCheckoutDraft((current) => ({
      ...current,
      ...user.savedAddress,
      paymentMethod: user.preferredPayment ?? current.paymentMethod ?? "card",
    }));
    return true;
  }, [personaId]);

  const setActiveUser = useCallback((id: PersonaId) => {
    // Switching identity: keep the cart, but clear highlights/compare and reset
    // the checkout draft to the new persona's (non-PII) defaults.
    setPersonaId(id);
    setHighlightedIds([]);
    setCompareIds([]);
    setCompareOpen(false);
    setCheckoutDraft(personaCheckoutDefaults(getUserProfile(id)));
  }, []);

  const placeOrder = useCallback(
    (details: CheckoutDetails) => {
      if (!cart.length) return null;
      const order: Order = {
        number: `VLT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
        userId: personaId,
        lines: cart,
        total: cartTotal(cart),
        details,
        placedAt: new Date().toISOString(),
        status: "processing",
      };
      setLastOrder(order);
      setSessionOrders((current) => [order, ...current]);
      setCart([]);
      return order;
    },
    [cart, personaId],
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
      applySavedAddress,
      personaId,
      activeUser,
      setActiveUser,
      sessionOrders,
      lastOrder,
      placeOrder,
    }),
    [hydrated, cart, addToCart, removeFromCart, setQuantity, clearCart, compareIds, toggleCompare, compareOpen, highlightedIds, checkoutDraft, updateCheckoutDraft, applySavedAddress, personaId, activeUser, setActiveUser, sessionOrders, lastOrder, placeOrder],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) throw new Error("useShop must be used inside <ShopProvider>");
  return context;
}
