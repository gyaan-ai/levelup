'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useCart } from '@/lib/cart-context';
import { formatEST } from '@/lib/format-date';
import { getSessionTypeDisplay } from '@/components/session-type-badge';

export function CartDropdown() {
  const { items, removeItem, clearCart, total, count } = useCart();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleCheckout = () => {
    setOpen(false);
    router.push('/cart/checkout');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex items-center justify-center min-h-[44px] min-w-[44px] p-1.5 text-white hover:text-accent transition-colors font-medium rounded hover:bg-white/10"
          aria-label={count > 0 ? `Cart (${count} sessions)` : 'Cart'}
          title="Cart"
        >
          <ShoppingCart className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-accent text-black rounded-full -translate-y-0.5 translate-x-0.5">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 sm:w-96 p-0" 
        align="end"
        sideOffset={8}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Your Cart</h3>
            {count > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {count === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Your cart is empty</p>
            <p className="text-xs mt-1">Add sessions from the Training page</p>
          </div>
        ) : (
          <>
            <div className="max-h-72 overflow-y-auto">
              {items.map((item) => {
                const dt = new Date(item.scheduled_datetime);
                const dayName = formatEST(dt, 'EEE');
                const { label: typeLabel } = getSessionTypeDisplay(item.session_type, null);
                
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {dayName}, {formatEST(dt, 'MMM d')} · {formatEST(dt, 'h:mm a')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.coach_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {typeLabel} · ${Number(item.price_per_participant ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded hover:bg-destructive/10"
                      aria-label="Remove from cart"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-border bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{count} session{count !== 1 ? 's' : ''}</span>
                <span className="font-semibold">${total.toFixed(2)}</span>
              </div>
              <Button onClick={handleCheckout} className="w-full">
                Checkout
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
