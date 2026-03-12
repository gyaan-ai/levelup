'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  pricePerParticipant: number;
  youthWrestlers: YouthWrestlerItem[];
}

export function SessionRegisterClient({ sessionId, pricePerParticipant, youthWrestlers }: SessionRegisterClientProps) {
  const router = useRouter();
  const [selectedWrestlerId, setSelectedWrestlerId] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePayAndRegister = async (e: React.FormEvent) => {
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
      if (!res.ok) throw new Error(data.error || 'Failed to start payment');
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      router.push(`/sessions/${sessionId}/register/confirmed`);
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  if (youthWrestlers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a wrestler profile from your dashboard before registering.
      </p>
    );
  }

  return (
    <form onSubmit={handlePayAndRegister} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="wrestler">Which wrestler is registering?</Label>
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
        {loading ? 'Redirecting to payment…' : `Pay $${pricePerParticipant.toFixed(2)} & register`}
      </Button>
    </form>
  );
}
