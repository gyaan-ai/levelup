'use client';

import { useState } from 'react';
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
  pricePerParticipant,
  youthWrestlers,
}: JoinSessionClientProps) {
  const [selectedWrestlerId, setSelectedWrestlerId] = useState<string>('');

  const handleJoin = () => {
    if (!selectedWrestlerId) {
      alert('Please select a youth wrestler.');
      return;
    }
    alert('Contact the session organizer to join. Payment is arranged directly with the coach.');
  };

  if (youthWrestlers.length === 0) {
    return (
      <div className="space-y-2 pt-2">
        <p className="text-sm text-muted-foreground">Add a youth wrestler to your account to join this session.</p>
        <Button asChild>
          <Link href="/wrestlers/add">Add Youth Wrestler</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4 border-t">
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
        disabled={!selectedWrestlerId}
        className="w-full bg-primary text-white hover:bg-primary/90"
      >
        Join for ${Number(pricePerParticipant).toFixed(2)}
      </Button>
    </div>
  );
}
