'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
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
}

interface SessionRegisterClientProps {
  sessionId: string;
  isOwner: boolean;
  pricePerParticipant: number;
  youthWrestlers: YouthWrestlerItem[];
  /** Preselect this wrestler (e.g. from Book again); must be in youthWrestlers. */
  initialWrestlerId?: string;
}

export function SessionRegisterClient({ sessionId, isOwner, pricePerParticipant, youthWrestlers, initialWrestlerId = '' }: SessionRegisterClientProps) {
  const router = useRouter();
  const [selectedWrestlerId, setSelectedWrestlerId] = useState(initialWrestlerId);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWrestlerId) {
      alert('Please select a wrestler.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youthWrestlerId: selectedWrestlerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (isOwner ? 'Failed to add wrestler' : 'Failed to start payment'));
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
      alert(err instanceof Error ? err.message : (isOwner ? 'Failed to add wrestler' : 'Payment failed'));
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
      <div className="space-y-2">
        <Label htmlFor="wrestler">{isOwner ? 'Which wrestler do you want to add?' : 'Which wrestler is registering?'}</Label>
        <Select value={selectedWrestlerId} onValueChange={setSelectedWrestlerId} required>
          <SelectTrigger id="wrestler">
            <SelectValue placeholder="Select wrestler" />
          </SelectTrigger>
          <SelectContent>
            {youthWrestlers.map((yw) => {
              const name = [yw.first_name, yw.last_name].filter(Boolean).join(' ');
              const extra = [yw.age && `${yw.age} yrs`, yw.weight_class, yw.skill_level].filter(Boolean).join(', ');
              const label = extra ? `${name} (${extra})` : name;
              return (
                <SelectItem key={yw.id} value={yw.id}>
                  {label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading
          ? (isOwner ? 'Adding…' : 'Redirecting to payment…')
          : isOwner
            ? 'Add wrestler'
            : `Pay $${pricePerParticipant.toFixed(2)} & register`}
      </Button>
    </form>
  );
}
