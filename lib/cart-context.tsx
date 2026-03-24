'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

export type CartSession = {
  id: string;
  scheduled_datetime: string;
  session_type: string | null;
  price_per_participant: number | null;
  coach_name: string;
  coach_id: string;
  facility_name: string;
};

type CartContextType = {
  items: CartSession[];
  addItem: (session: CartSession) => void;
  removeItem: (sessionId: string) => void;
  clearCart: () => void;
  isInCart: (sessionId: string) => boolean;
  total: number;
  count: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'guild_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartSession[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load cart from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Filter out past sessions
        const now = new Date();
        const validItems = parsed.filter((item: CartSession) => new Date(item.scheduled_datetime) > now);
        setItems(validItems);
      }
    } catch {
      // Ignore storage errors
    }
    setHydrated(true);
  }, []);

  // Save cart to sessionStorage when it changes
  useEffect(() => {
    if (hydrated) {
      try {
        sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch {
        // Ignore storage errors
      }
    }
  }, [items, hydrated]);

  const addItem = useCallback((session: CartSession) => {
    setItems((prev) => {
      if (prev.some((item) => item.id === session.id)) return prev;
      return [...prev, session];
    });
  }, []);

  const removeItem = useCallback((sessionId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== sessionId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const isInCart = useCallback((sessionId: string) => {
    return items.some((item) => item.id === sessionId);
  }, [items]);

  const total = items.reduce((sum, item) => sum + (item.price_per_participant ?? 0), 0);
  const count = items.length;

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, isInCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
