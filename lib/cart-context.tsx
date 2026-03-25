'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export type CartSession = {
  id: string;
  scheduled_datetime: string;
  session_type: string | null;
  price_per_participant: number | null;
  coach_name: string;
  coach_id: string;
  facility_name: string;
  athlete_id?: string | null; // Selected wrestler for this booking
};

type CartContextType = {
  items: CartSession[];
  addItem: (session: CartSession) => void;
  removeItem: (sessionId: string) => void;
  clearCart: () => void;
  isInCart: (sessionId: string) => boolean;
  setAthleteForItem: (sessionId: string, athleteId: string | null) => void;
  total: number;
  count: number;
  isLoading: boolean;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'guild_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartSession[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Load cart on mount - try Supabase first, fallback to sessionStorage
  useEffect(() => {
    async function loadCart() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      if (user) {
        // Try to load from Supabase
        try {
          const { data: cartItems } = await supabase
            .from('cart_items')
            .select(`
              id,
              session_id,
              athlete_id,
              sessions:session_id(
                id,
                scheduled_datetime,
                session_type,
                price_per_participant,
                athlete_id,
                facility_id,
                athletes:athlete_id(first_name, last_name),
                facilities:facility_id(name)
              )
            `)
            .eq('user_id', user.id);

          if (cartItems && cartItems.length > 0) {
            const now = new Date();
            const validItems: CartSession[] = cartItems
              .filter((ci) => {
                const session = Array.isArray(ci.sessions) ? ci.sessions[0] : ci.sessions;
                return session && new Date(session.scheduled_datetime) > now;
              })
              .map((ci) => {
                const session = Array.isArray(ci.sessions) ? ci.sessions[0] : ci.sessions;
                const athlete = session?.athletes ? (Array.isArray(session.athletes) ? session.athletes[0] : session.athletes) : null;
                const facility = session?.facilities ? (Array.isArray(session.facilities) ? session.facilities[0] : session.facilities) : null;
                return {
                  id: session?.id || ci.session_id,
                  scheduled_datetime: session?.scheduled_datetime || '',
                  session_type: session?.session_type || null,
                  price_per_participant: session?.price_per_participant || null,
                  coach_name: athlete ? `${athlete.first_name || ''} ${athlete.last_name || ''}`.trim() : 'Coach',
                  coach_id: session?.athlete_id || '',
                  facility_name: facility?.name || 'Facility',
                  athlete_id: ci.athlete_id,
                };
              });
            setItems(validItems);
            setHydrated(true);
            setIsLoading(false);
            return;
          }
        } catch {
          // Table may not exist, fall through to sessionStorage
        }
      }

      // Fallback to sessionStorage
      try {
        const stored = sessionStorage.getItem(CART_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const now = new Date();
          const validItems = parsed.filter((item: CartSession) => new Date(item.scheduled_datetime) > now);
          setItems(validItems);

          // If user is logged in, sync sessionStorage cart to Supabase
          if (user && validItems.length > 0) {
            syncToSupabase(user.id, validItems);
          }
        }
      } catch {
        // Ignore storage errors
      }
      setHydrated(true);
      setIsLoading(false);
    }

    loadCart();
  }, []);

  // Sync cart to Supabase (fire and forget)
  const syncToSupabase = async (uid: string, cartItems: CartSession[]) => {
    const supabase = createClient();
    try {
      // Clear existing cart items for user
      await supabase.from('cart_items').delete().eq('user_id', uid);
      
      // Insert new items
      if (cartItems.length > 0) {
        await supabase.from('cart_items').insert(
          cartItems.map((item) => ({
            user_id: uid,
            session_id: item.id,
            athlete_id: item.athlete_id || null,
          }))
        );
      }
    } catch {
      // Ignore errors - table may not exist
    }
  };

  // Save cart to sessionStorage when it changes (and sync to Supabase if logged in)
  useEffect(() => {
    if (hydrated) {
      try {
        sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch {
        // Ignore storage errors
      }

      // Sync to Supabase if user is logged in
      if (userId) {
        syncToSupabase(userId, items);
      }
    }
  }, [items, hydrated, userId]);

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

  const setAthleteForItem = useCallback((sessionId: string, athleteId: string | null) => {
    setItems((prev) => 
      prev.map((item) => 
        item.id === sessionId ? { ...item, athlete_id: athleteId } : item
      )
    );
  }, []);

  const total = items.reduce((sum, item) => sum + (item.price_per_participant ?? 0), 0);
  const count = items.length;

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, isInCart, setAthleteForItem, total, count, isLoading }}>
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
