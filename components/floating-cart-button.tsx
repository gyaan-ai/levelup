'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { cn } from '@/lib/utils';

/**
 * Floating cart button for mobile - shows above bottom nav when items are in cart.
 */
export function FloatingCartButton() {
  const { count, total } = useCart();

  if (count === 0) return null;

  return (
    <Link
      href="/cart/checkout"
      className={cn(
        'fixed bottom-20 right-4 z-50 md:hidden',
        'flex items-center gap-2 px-4 py-3 rounded-full',
        'bg-accent text-black font-medium shadow-lg',
        'hover:bg-accent/90 transition-colors',
        'animate-in slide-in-from-bottom-4 duration-300'
      )}
    >
      <ShoppingCart className="h-5 w-5" />
      <span>{count}</span>
      <span className="text-sm opacity-80">${total.toFixed(0)}</span>
    </Link>
  );
}
