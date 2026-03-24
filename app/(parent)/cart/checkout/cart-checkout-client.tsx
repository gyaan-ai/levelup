'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShoppingCart, X, ArrowLeft, CreditCard, Loader2 } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { formatEST } from '@/lib/format-date';
import { getSessionTypeDisplay } from '@/components/session-type-badge';

type Wrestler = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
};

export function CartCheckoutClient({
  wrestlers,
  userEmail,
}: {
  wrestlers: Wrestler[];
  userEmail: string;
}) {
  const router = useRouter();
  const { items, removeItem, clearCart, total, count } = useCart();
  const [selectedWrestler, setSelectedWrestler] = useState(wrestlers[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (!selectedWrestler) {
      setError('Please select a wrestler');
      return;
    }
    if (items.length === 0) {
      setError('Your cart is empty');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionIds: items.map((item) => item.id),
          wrestlerId: selectedWrestler,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Checkout failed');
        return;
      }

      // Redirect to Stripe checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (count === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
          <p className="text-muted-foreground mb-6">Add sessions from the Training page to get started.</p>
          <Button asChild>
            <Link href="/training">Browse Training</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/training" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Training
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Checkout ({count} session{count !== 1 ? 's' : ''})
          </CardTitle>
          <CardDescription>
            Review your sessions and complete payment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Wrestler Selection */}
          {wrestlers.length > 0 && (
            <div>
              <Label htmlFor="wrestler">Select Wrestler</Label>
              <Select value={selectedWrestler} onValueChange={setSelectedWrestler}>
                <SelectTrigger id="wrestler" className="min-h-[44px]">
                  <SelectValue placeholder="Choose a wrestler" />
                </SelectTrigger>
                <SelectContent>
                  {wrestlers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {[w.first_name, w.last_name].filter(Boolean).join(' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                This wrestler will be registered for all sessions in your cart
              </p>
            </div>
          )}

          {/* Session List */}
          <div className="space-y-3">
            <Label>Sessions</Label>
            <div className="border border-border rounded-lg divide-y divide-border">
              {items.map((item) => {
                const dt = new Date(item.scheduled_datetime);
                const dayName = formatEST(dt, 'EEE');
                const { label: typeLabel } = getSessionTypeDisplay(item.session_type, null);

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">
                        {dayName}, {formatEST(dt, 'MMM d, yyyy')} · {formatEST(dt, 'h:mm a')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.coach_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {typeLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        ${Number(item.price_per_participant ?? 0).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded hover:bg-destructive/10"
                        aria-label="Remove from cart"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <span className="text-lg font-medium">Total</span>
            <span className="text-2xl font-bold">${total.toFixed(2)}</span>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Checkout Button */}
          <Button
            onClick={handleCheckout}
            disabled={loading || !selectedWrestler}
            className="w-full min-h-[48px] text-base gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Pay ${total.toFixed(2)}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            You will be redirected to Stripe to complete payment
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
