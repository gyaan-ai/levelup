'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface YouthWrestlerItem {
  id: string;
  first_name?: string;
  last_name?: string;
  age?: number;
  weight_class?: string;
  skill_level?: string;
  /** False = no 10-digit cell on file; payment API will reject until fixed */
  hasValidCell?: boolean;
}

interface SessionRegisterClientProps {
  sessionId: string;
  isOwner: boolean;
  isSmallGroup?: boolean;
  pricePerParticipant: number;
  priceAfterDiscount?: number;
  percentOff?: number;
  youthWrestlers: YouthWrestlerItem[];
  initialWrestlerId?: string;
}

export function SessionRegisterClient({ sessionId, isOwner, isSmallGroup = false, pricePerParticipant, priceAfterDiscount, percentOff, youthWrestlers, initialWrestlerId = '' }: SessionRegisterClientProps) {
  const router = useRouter();
  const [selectedWrestlerId, setSelectedWrestlerId] = useState(initialWrestlerId);
  const [promoCode, setPromoCode] = useState('');
  const [codeApplied, setCodeApplied] = useState(false);
  const [applyingCode, setApplyingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);

  const displayPrice = priceAfterDiscount ?? pricePerParticipant;

  const selectedWrestler = youthWrestlers.find((yw) => yw.id === selectedWrestlerId);
  const selectedHasCell = selectedWrestler?.hasValidCell !== false;

  const handleApplyCode = async () => {
    const codeTrimmed = promoCode.trim();
    if (!codeTrimmed) return;
    setError(null);
    setApplyingCode(true);
    try {
      const redeemRes = await fetch('/api/redeem-discount-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeTrimmed }),
      });
      const data = await redeemRes.json();
      if (redeemRes.ok && (data.success || data.alreadyUsed)) {
        setCodeApplied(true);
        router.refresh();
      } else {
        setError(data.error || 'Invalid or expired promo code');
      }
    } catch {
      setError('Could not apply code. Try again.');
    } finally {
      setApplyingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLock.current || loading) return;
    if (!selectedWrestlerId) {
      setError('Please select a wrestler.');
      return;
    }
    if (selectedWrestler && selectedWrestler.hasValidCell === false) {
      setError('Add this athlete’s cell number on their profile first.');
      return;
    }
    setError(null);
    submitLock.current = true;
    setLoading(true);
    try {
      const codeTrimmed = promoCode.trim();
      if (codeTrimmed && !isOwner && !codeApplied) {
        const redeemRes = await fetch('/api/redeem-discount-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: codeTrimmed }),
        });
        const redeemData = await redeemRes.json();
        if (!redeemRes.ok && !redeemData.alreadyUsed) {
          setError(redeemData.error || 'Invalid or expired promo code');
          setLoading(false);
          submitLock.current = false;
          return;
        }
        if (redeemRes.ok && (redeemData.success || redeemData.alreadyUsed)) setCodeApplied(true);
      }

      const res = await fetch(`/api/sessions/${sessionId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youthWrestlerId: selectedWrestlerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || (isOwner ? 'Failed to add wrestler' : 'Failed to start payment');
        setError(msg);
        submitLock.current = false;
        return;
      }
      if (data.added) {
        router.push(`/sessions/${sessionId}/register/confirmed`);
        router.refresh();
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      router.push(`/sessions/${sessionId}/register/confirmed`);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (isOwner ? 'Failed to add wrestler' : 'Payment failed');
      setError(msg);
      submitLock.current = false;
    } finally {
      setLoading(false);
    }
  };

  if (youthWrestlers.length === 0) {
    const addUrl = `/wrestlers/add?redirect=${encodeURIComponent(`/sessions/${sessionId}/register`)}`;
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          You don’t have a wrestler profile yet. Add one, then come back here to add them to this session.
        </p>
        <Button asChild className="bg-accent text-black hover:bg-accent-hover">
          <Link href={addUrl}>Add a wrestler</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="space-y-2">
        <Label htmlFor="wrestler">{isOwner ? 'Which wrestler do you want to add?' : 'Which wrestler is registering?'}</Label>
        <Select value={selectedWrestlerId} onValueChange={(v) => { setSelectedWrestlerId(v); setError(null); }} required>
          <SelectTrigger id="wrestler">
            <SelectValue placeholder="Select wrestler" />
          </SelectTrigger>
          <SelectContent>
            {youthWrestlers.map((yw) => {
              const name = [yw.first_name, yw.last_name].filter(Boolean).join(' ');
              const extra = [yw.age && `${yw.age} yrs`, yw.weight_class, yw.skill_level].filter(Boolean).join(', ');
              const label = extra ? `${name} (${extra})` : name;
              const needPhone = yw.hasValidCell === false;
              return (
                <SelectItem key={yw.id} value={yw.id}>
                  {label}
                  {needPhone ? ' — add cell to register' : ''}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {selectedWrestlerId && !selectedHasCell && (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm space-y-2">
            <p className="text-destructive font-medium">
              Cell number required on this athlete’s profile before you can add them or pay.
            </p>
            <p className="text-muted-foreground">
              Add a 10-digit mobile number (Wrestlers → Edit), then return here.
            </p>
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link
                href={`/wrestlers/${selectedWrestlerId}/edit?redirect=${encodeURIComponent(`/sessions/${sessionId}/register`)}`}
              >
                Edit {selectedWrestler?.first_name ?? 'athlete'} — add cell
              </Link>
            </Button>
          </div>
        )}
      </div>
      {!isOwner && (
        <div className="space-y-2">
          <Label htmlFor="promo">Promo code (optional)</Label>
          <div className="flex gap-2">
            <Input
              id="promo"
              type="text"
              placeholder=""
              value={promoCode}
              onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setError(null); setCodeApplied(false); }}
              className="uppercase flex-1"
              autoComplete="off"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleApplyCode}
              disabled={!promoCode.trim() || applyingCode}
            >
              {applyingCode ? 'Applying…' : 'Apply'}
            </Button>
          </div>
          {isSmallGroup && percentOff != null && (
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
              {codeApplied ? `Code applied. You get ${percentOff}% off — pay & register below.` : `Your ${percentOff}% discount applies — pay & register below.`}
            </p>
          )}
        </div>
      )}
      <Button
        type="submit"
        disabled={loading || (selectedWrestler != null && selectedWrestler.hasValidCell === false)}
        className="w-full"
      >
        {loading
          ? (isOwner ? 'Adding…' : 'Redirecting to payment…')
          : isOwner
            ? 'Add wrestler'
            : `Pay $${displayPrice.toFixed(2)} & register`}
      </Button>
    </form>
  );
}
