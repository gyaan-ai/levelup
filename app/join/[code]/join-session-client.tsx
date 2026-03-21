'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface YouthWrestlerOption {
  id: string;
  first_name: string;
  last_name: string;
  age?: number;
  weight_class?: string;
  skill_level?: string;
  hasValidCell?: boolean;
}

interface JoinSessionClientProps {
  sessionId: string;
  code: string;
  isSmallGroup?: boolean;
  pricePerParticipant: number;
  priceAfterDiscount?: number;
  percentOff?: number;
  youthWrestlers: YouthWrestlerOption[];
}

export function JoinSessionClient({
  sessionId,
  code,
  isSmallGroup = false,
  pricePerParticipant,
  priceAfterDiscount,
  percentOff,
  youthWrestlers,
}: JoinSessionClientProps) {
  const router = useRouter();
  const [selectedWrestlerId, setSelectedWrestlerId] = useState<string>('');
  const [promoCode, setPromoCode] = useState('');
  const [codeApplied, setCodeApplied] = useState(false);
  const [applyingCode, setApplyingCode] = useState(false);
  const [joining, setJoining] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayPrice = priceAfterDiscount ?? pricePerParticipant;
  const selectedWrestler = youthWrestlers.find((w) => w.id === selectedWrestlerId);
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

  const handlePayAndRegister = async () => {
    if (!selectedWrestlerId) {
      setError('Please select a youth wrestler.');
      return;
    }
    if (selectedWrestler && selectedWrestler.hasValidCell === false) {
      setError('Add this athlete’s cell number on their profile before paying.');
      return;
    }
    setError(null);
    setJoining(true);
    try {
      const codeTrimmed = promoCode.trim();
      if (codeTrimmed && !codeApplied) {
        const redeemRes = await fetch('/api/redeem-discount-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: codeTrimmed }),
        });
        const redeemData = await redeemRes.json();
        if (!redeemRes.ok && !redeemData.alreadyUsed) {
          setError(redeemData.error || 'Invalid or expired promo code');
          setJoining(false);
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
        setError(data.error || 'Failed to start payment');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setRegistered(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  if (youthWrestlers.length === 0) {
    return (
      <div className="space-y-2 pt-2">
        <p className="text-sm text-muted-foreground">Add your wrestler to your account first, then you can join this session.</p>
        <Button asChild>
          <Link href={`/wrestlers/add?redirect=${encodeURIComponent(`/join/${code}`)}`}>
            Add Youth Wrestler
          </Link>
        </Button>
      </div>
    );
  }

  if (registered) {
    return (
      <div className="space-y-4 pt-4 border-t rounded-lg bg-muted/30 p-4">
        <p className="font-medium text-foreground">You&apos;re registered. See you there.</p>
        <p className="text-sm text-muted-foreground">
          This session is on your Dashboard and Bookings. Payment was collected in the app.
        </p>
        <Button asChild className="w-full bg-accent text-black hover:bg-accent-hover">
          <Link href="/dashboard">View Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4 border-t">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <div className="space-y-2">
        <Label htmlFor="wrestler">Select Your Wrestler</Label>
        <Select value={selectedWrestlerId} onValueChange={(v) => { setSelectedWrestlerId(v); setError(null); }}>
          <SelectTrigger id="wrestler">
            <SelectValue placeholder="Choose wrestler" />
          </SelectTrigger>
          <SelectContent>
            {youthWrestlers.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.first_name} {w.last_name}
                {w.age != null ? ` (${w.age} yrs)` : ''}
                {w.weight_class ? ` — ${w.weight_class} lbs` : ''}
                {w.hasValidCell === false ? ' — add cell to register' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedWrestlerId && !selectedHasCell && (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm space-y-2">
            <p className="text-destructive font-medium">Cell number required on this athlete’s profile before checkout.</p>
            <p className="text-muted-foreground">Add a 10-digit mobile number, then come back to this page.</p>
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link
                href={`/wrestlers/${selectedWrestlerId}/edit?redirect=${encodeURIComponent(`/join/${code}`)}`}
              >
                Edit {selectedWrestler?.first_name ?? 'athlete'} — add cell
              </Link>
            </Button>
          </div>
        )}
      </div>
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
        {percentOff != null && isSmallGroup && (
          <p className="text-sm text-green-600 dark:text-green-400 font-medium">
            {codeApplied ? `Code applied. You get ${percentOff}% off — pay & register below.` : `Your ${percentOff}% discount applies — pay & register below.`}
          </p>
        )}
      </div>
      <Button
        onClick={handlePayAndRegister}
        disabled={!selectedWrestlerId || joining || (selectedWrestler != null && selectedWrestler.hasValidCell === false)}
        className="w-full bg-accent text-black hover:bg-accent-hover"
      >
        {joining
          ? 'Redirecting to payment…'
          : `Pay $${displayPrice.toFixed(2)} & register`}
      </Button>
    </div>
  );
}
