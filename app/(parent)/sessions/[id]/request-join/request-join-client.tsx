'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

interface RequestJoinClientProps {
  sessionId: string;
  youthWrestlers: YouthWrestlerItem[];
}

export function RequestJoinClient({ sessionId, youthWrestlers }: RequestJoinClientProps) {
  const router = useRouter();
  const [selectedWrestlerId, setSelectedWrestlerId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWrestlerId) {
      alert('Please select a youth wrestler.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/session-join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          youthWrestlerId: selectedWrestlerId,
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      router.push('/small-group-sessions?requested=1');
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  if (youthWrestlers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a youth wrestler profile from your dashboard before requesting to join.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="wrestler">Which wrestler is requesting to join?</Label>
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
      <div className="space-y-2">
        <Label htmlFor="message">Message to session owner (optional)</Label>
        <Textarea
          id="message"
          placeholder="e.g. Similar weight and experience level, would love to join."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? 'Sending…' : 'Send join request'}
      </Button>
    </form>
  );
}
