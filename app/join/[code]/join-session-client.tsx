'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
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
}

interface JoinSessionClientProps {
  sessionId: string;
  code: string;
  pricePerParticipant: number;
  youthWrestlers: YouthWrestlerOption[];
}

export function JoinSessionClient({
  sessionId,
  code,
  pricePerParticipant,
  youthWrestlers,
}: JoinSessionClientProps) {
  const router = useRouter();
  const [selectedWrestlerId, setSelectedWrestlerId] = useState<string>('');
  const [joining, setJoining] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayAndRegister = async () => {
    if (!selectedWrestlerId) {
      setError('Please select a youth wrestler.');
      return;
    }
    setError(null);
    setJoining(true);
    try {
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
          <Link href="/dashboard?tab=scheduled">View Dashboard</Link>
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
        <Select value={selectedWrestlerId} onValueChange={setSelectedWrestlerId}>
          <SelectTrigger id="wrestler">
            <SelectValue placeholder="Choose wrestler" />
          </SelectTrigger>
          <SelectContent>
            {youthWrestlers.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.first_name} {w.last_name}
                {w.age != null ? ` (${w.age} yrs)` : ''}
                {w.weight_class ? ` — ${w.weight_class} lbs` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        onClick={handlePayAndRegister}
        disabled={!selectedWrestlerId || joining}
        className="w-full bg-accent text-black hover:bg-accent-hover"
      >
        {joining ? 'Redirecting to payment…' : `Pay $${pricePerParticipant.toFixed(2)} & register`}
      </Button>
    </div>
  );
}
