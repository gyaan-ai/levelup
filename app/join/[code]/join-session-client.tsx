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

  const handleJoin = async () => {
    if (!selectedWrestlerId) {
      setError('Please select a youth wrestler.');
      return;
    }
    setError(null);
    setJoining(true);
    try {
      const res = await fetch('/api/sessions/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase(), youthWrestlerId: selectedWrestlerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to register');
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
          This session is on your My Bookings page. The coach or organizer will reach out about payment if needed.
        </p>
        <Button asChild className="w-full bg-accent text-black hover:bg-accent-hover">
          <Link href="/bookings">View My Bookings</Link>
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
        onClick={handleJoin}
        disabled={!selectedWrestlerId || joining}
        className="w-full bg-accent text-black hover:bg-accent-hover"
      >
        {joining ? 'Registering…' : 'Register for this session'}
      </Button>
      <p className="text-xs text-muted-foreground">
        No charge online. Payment is arranged with the coach or organizer.
      </p>
    </div>
  );
}
