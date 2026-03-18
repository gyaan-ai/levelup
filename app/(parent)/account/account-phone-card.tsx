'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone } from 'lucide-react';

export function AccountPhoneCard({ initialPhone }: { initialPhone: string | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<'success' | 'error' | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage('error');
        return;
      }
      setMessage('success');
      router.refresh();
    } catch {
      setMessage('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Contact
        </CardTitle>
        <CardDescription>Your cell phone (optional). Used for session contact.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="account-phone">Cell phone</Label>
          <Input
            id="account-phone"
            type="tel"
            placeholder="e.g. 555-123-4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {message === 'success' && (
          <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>
        )}
        {message === 'error' && (
          <p className="text-sm text-destructive">Failed to save. Try again.</p>
        )}
      </CardContent>
    </Card>
  );
}
