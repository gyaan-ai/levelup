'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function RequestFacilityBlock({ className = '' }: { className?: string }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !school.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/facility-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), school: school.trim(), address: address.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess(true);
        setShowForm(false);
        setName('');
        setSchool('');
        setAddress('');
      } else {
        setError(data.error || 'Request failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={className}>
      {success ? (
        <p className="text-sm text-green-600 dark:text-green-400">Request submitted. We&apos;ll add the facility after review.</p>
      ) : showForm ? (
        <form onSubmit={handleSubmit} className="space-y-3 p-3 border border-border rounded-md bg-muted/30">
          <p className="text-sm font-medium">Request a facility not on the list</p>
          <Input placeholder="Facility name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input placeholder="School (e.g. NC State)" value={school} onChange={(e) => setSchool(e.target.value)} required />
          <Input placeholder="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit request'}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="link" className="p-0 h-auto text-sm" onClick={() => setShowForm(true)}>
          Don&apos;t see your facility? Request one
        </Button>
      )}
    </div>
  );
}
