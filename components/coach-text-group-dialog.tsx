'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Smartphone } from 'lucide-react';

type RecipientOption = { value: string; label: string; group: 'everyone' | 'individual' };

type Props = {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "Sun, Mar 22 · 11:00 AM" */
  sessionLabel: string;
  onSent?: () => void;
};

export function CoachTextGroupDialog({ sessionId, open, onOpenChange, sessionLabel, onSent }: Props) {
  const [text, setText] = useState('');
  const [target, setTarget] = useState('broadcast:parents');
  const [options, setOptions] = useState<RecipientOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; skippedNoPhone: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingOptions(true);
    fetch(`/api/sessions/${sessionId}/sms-recipients`)
      .then((r) => r.json())
      .then((data: { options?: RecipientOption[] }) => {
        if (cancelled || !data.options?.length) return;
        setOptions(data.options);
        setTarget((prev) => (data.options!.some((o) => o.value === prev) ? prev : 'broadcast:parents'));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);

  const handleSend = async () => {
    const msg = text.trim();
    if (!msg || sending) return;
    setError(null);
    setResult(null);
    setSending(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/sms-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not send');
        if (data.sent != null) setResult({ sent: data.sent, skippedNoPhone: data.skippedNoPhone ?? 0 });
        return;
      }
      setResult({ sent: data.sent ?? 0, skippedNoPhone: data.skippedNoPhone ?? 0 });
      setText('');
      onSent?.();
    } catch {
      setError('Network error');
    } finally {
      setSending(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setError(null);
      setResult(null);
      setText('');
      setTarget('broadcast:parents');
    }
    onOpenChange(v);
  };

  const everyoneOpts =
    options.filter((o) => o.group === 'everyone').length > 0
      ? options.filter((o) => o.group === 'everyone')
      : [
          { value: 'broadcast:parents', label: 'All parents', group: 'everyone' as const },
          { value: 'broadcast:athletes', label: 'All athletes', group: 'everyone' as const },
          { value: 'broadcast:both', label: 'Everyone (parents + athletes, deduped)', group: 'everyone' as const },
        ];
  const individualOpts = options.filter((o) => o.group === 'individual');

  const targetHint =
    target.startsWith('parent:') || target.startsWith('athlete:')
      ? 'Sends one SMS to that person’s number on file.'
      : target === 'broadcast:athletes'
        ? 'Athlete cell on each wrestler profile only.'
        : target === 'broadcast:both'
          ? 'Parents + athletes — one SMS per unique number.'
          : 'Parent accounts (or athlete cell as fallback).';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-accent" />
            Text the group
          </DialogTitle>
          <DialogDescription className="text-left space-y-2">
            <span className="block text-foreground/90">{sessionLabel}</span>
            <span className="block text-muted-foreground text-sm">Requires Twilio on the server. {targetHint}</span>
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
            <p className="font-medium text-foreground">Sent to {result.sent} number{result.sent === 1 ? '' : 's'}.</p>
            {result.skippedNoPhone > 0 && (
              <p className="text-muted-foreground">
                {result.skippedNoPhone} recipient{result.skippedNoPhone === 1 ? '' : 's'} had no cell on file for this send.
              </p>
            )}
            <Button type="button" variant="outline" className="mt-2 w-full" onClick={() => handleClose(false)}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="sms-target">Send to</Label>
              <Select
                value={target}
                onValueChange={setTarget}
                disabled={sending || loadingOptions}
              >
                <SelectTrigger id="sms-target" className="min-h-[44px] w-full">
                  <SelectValue placeholder={loadingOptions ? 'Loading…' : 'Who receives this text'} />
                </SelectTrigger>
                <SelectContent className="max-h-[min(60vh,320px)]">
                  {everyoneOpts.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Everyone</SelectLabel>
                      {everyoneOpts.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {individualOpts.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>One person</SelectLabel>
                        {individualOpts.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
              {loadingOptions && <p className="text-xs text-muted-foreground">Loading roster…</p>}
            </div>
            <Textarea
              placeholder="e.g. Practice moved to 11:30 — see you at UNC."
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              className="min-h-[120px] resize-y"
              maxLength={1200}
              disabled={sending}
            />
            <p className="text-xs text-muted-foreground">{text.length}/1200</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={sending}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-accent text-primary hover:bg-accent/90"
                onClick={handleSend}
                disabled={sending || !text.trim() || loadingOptions}
              >
                {sending ? 'Sending…' : 'Send SMS'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
