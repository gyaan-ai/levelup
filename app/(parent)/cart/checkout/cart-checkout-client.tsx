'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ShoppingCart, X, ArrowLeft, CreditCard, Loader2, Wallet, Tag, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useCart } from '@/lib/cart-context';
import { formatEST } from '@/lib/format-date';
import { getSessionTypeDisplay } from '@/components/session-type-badge';

const fetcher = (url: string) => fetch(url).then(r => r.json());

type Wrestler = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
};

export function CartCheckoutClient({
  wrestlers,
  userEmail,
  existingDiscount,
}: {
  wrestlers: Wrestler[];
  userEmail: string;
  existingDiscount?: number;
}) {
  const router = useRouter();
  const { items, removeItem, clearCart, total, count } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<number>(existingDiscount ?? 0);
  const [promoApplied, setPromoApplied] = useState(!!existingDiscount);

  const allLinesHaveWrestler = items.length > 0 && items.every((i) => i.athlete_id);

  // Fetch credit balance
  const { data: creditsData } = useSWR('/api/credits', fetcher);
  const creditBalance = creditsData?.balance ?? 0;
  
  // Calculate totals with discount
  const discountAmount = appliedDiscount > 0 ? total * (appliedDiscount / 100) : 0;
  const subtotalAfterDiscount = total - discountAmount;
  const creditsToApply = Math.min(creditBalance, subtotalAfterDiscount);
  const amountToPay = subtotalAfterDiscount - creditsToApply;
  
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    
    setPromoLoading(true);
    setPromoError(null);
    
    try {
      const res = await fetch('/api/redeem-discount-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim().toUpperCase() }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setPromoError(data.error || 'Invalid promo code');
        return;
      }
      
      setAppliedDiscount(data.percent_off);
      setPromoApplied(true);
      setPromoError(null);
    } catch {
      setPromoError('Failed to apply promo code');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (items.length === 0) {
      setError('Your cart is empty');
      return;
    }
    if (!allLinesHaveWrestler) {
      setError('Select a wrestler for each spot (go back to your cart).');
      return;
    }

    const lines = items
      .filter((i) => i.athlete_id)
      .map((i) => ({ sessionId: i.id, wrestlerId: i.athlete_id as string }));
    const pairKeys = new Set(lines.map((l) => `${l.sessionId}:${l.wrestlerId}`));
    if (pairKeys.size !== lines.length) {
      setError('Each spot must be for a different wrestler when booking the same session twice.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Checkout failed');
        return;
      }

      // If paid with credits entirely, redirect to success
      if (data.paidWithCredits && data.redirectUrl) {
        clearCart();
        router.push(data.redirectUrl);
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
            Checkout ({count} spot{count !== 1 ? 's' : ''})
          </CardTitle>
          <CardDescription>
            Review each spot and complete payment in one transaction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!allLinesHaveWrestler && items.length > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Go back to your cart and choose which wrestler each spot is for before paying.
            </p>
          )}

          {/* Session List */}
          <div className="space-y-3">
            <Label>Sessions</Label>
            <div className="border border-border rounded-lg divide-y divide-border">
              {items.map((item) => {
                const dt = new Date(item.scheduled_datetime);
                const dayName = formatEST(dt, 'EEE');
                const { label: typeLabel } = getSessionTypeDisplay(item.session_type, null);
                const w = wrestlers.find((x) => x.id === item.athlete_id);

                return (
                  <div
                    key={item.lineId}
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
                      {w && (
                        <p className="text-sm text-foreground mt-1">
                          Wrestler: {[w.first_name, w.last_name].filter(Boolean).join(' ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        ${Number(item.price_per_participant ?? 0).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.lineId)}
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

          {/* Promo Code */}
          <div className="space-y-2">
            <Label htmlFor="promo">Promo Code</Label>
            {promoApplied ? (
              <div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/20 rounded-lg">
                <Check className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium text-accent">
                  {appliedDiscount}% discount applied
                </span>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  id="promo"
                  placeholder="Enter code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleApplyPromo}
                  disabled={promoLoading || !promoCode.trim()}
                >
                  {promoLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Tag className="h-4 w-4 mr-1" />
                      Apply
                    </>
                  )}
                </Button>
              </div>
            )}
            {promoError && (
              <p className="text-xs text-destructive">{promoError}</p>
            )}
          </div>

          {/* Totals */}
          <div className="space-y-2 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${total.toFixed(2)}</span>
            </div>
            
            {appliedDiscount > 0 && (
              <div className="flex items-center justify-between text-accent">
                <span className="flex items-center gap-1.5">
                  <Tag className="h-4 w-4" />
                  Promo ({appliedDiscount}% off)
                </span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            
            {creditBalance > 0 && (
              <div className="flex items-center justify-between text-accent">
                <span className="flex items-center gap-1.5">
                  <Wallet className="h-4 w-4" />
                  Credit applied
                </span>
                <span>-${creditsToApply.toFixed(2)}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-lg font-medium">Total due</span>
              <span className="text-2xl font-bold">${amountToPay.toFixed(2)}</span>
            </div>

            {creditBalance > 0 && creditsToApply < creditBalance && (
              <p className="text-xs text-muted-foreground">
                Remaining credit balance after purchase: ${(creditBalance - creditsToApply).toFixed(2)}
              </p>
            )}
            
            {appliedDiscount > 0 && creditBalance === 0 && (
              <p className="text-xs text-muted-foreground">
                You saved ${discountAmount.toFixed(2)} with your promo code!
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Checkout Button */}
          <Button
            onClick={handleCheckout}
            disabled={loading || !allLinesHaveWrestler}
            className="w-full min-h-[48px] text-base gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : amountToPay <= 0 ? (
              <>
                <Wallet className="h-5 w-5" />
                Pay with Credit
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Pay ${amountToPay.toFixed(2)}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            {amountToPay <= 0 
              ? 'Your credit balance covers this purchase'
              : creditsToApply > 0
                ? `$${creditsToApply.toFixed(2)} credit applied. You'll pay $${amountToPay.toFixed(2)} via Stripe.`
                : 'You will be redirected to Stripe to complete payment'
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
