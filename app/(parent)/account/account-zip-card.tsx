'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, ChevronRight, Check, X } from 'lucide-react';
import { normalizeUsZipCode } from '@/lib/us-zip';

export function AccountZipCard({ initialZip, compact }: { initialZip: string | null; compact?: boolean }) {
  const router = useRouter();
  const [zip, setZip] = useState(initialZip ?? '');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(!initialZip);
  const [message, setMessage] = useState<'success' | 'error' | null>(null);

  const handleSave = async () => {
    const n = normalizeUsZipCode(zip);
    if (!n) {
      setMessage('error');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipCode: n }),
      });
      if (!res.ok) {
        setMessage('error');
        return;
      }
      setMessage('success');
      setEditing(false);
      setZip(n);
      router.refresh();
    } catch {
      setMessage('error');
    } finally {
      setSaving(false);
    }
  };

  if (compact) {
    return (
      <div className="px-4 py-3.5 hover:bg-zinc-800/50 transition-colors">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-zinc-400 shrink-0" />
          {editing ? (
            <div className="flex-1 flex flex-col gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="Home ZIP (required)"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className="flex h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1 text-sm text-white placeholder:text-zinc-500"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors"
                  aria-label="Save ZIP"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setZip(initialZip ?? '');
                    setMessage(null);
                  }}
                  className="p-2 text-zinc-500 hover:bg-zinc-700/50 rounded-lg transition-colors"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 flex items-center justify-between text-left min-h-[44px] touch-manipulation"
            >
              <span className="font-medium">Home ZIP code</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500">{initialZip || 'Add'}</span>
                <ChevronRight className="h-4 w-4 text-zinc-600" />
              </div>
            </button>
          )}
        </div>
        {message === 'error' && (
          <p className="text-xs text-destructive mt-2 pl-8">
            Enter a valid 5-digit U.S. ZIP code (ZIP+4 ok). Required for maps and nearby features.
          </p>
        )}
        {message === 'success' && <p className="text-xs text-green-500 mt-2 pl-8">Saved.</p>}
      </div>
    );
  }

  return null;
}
