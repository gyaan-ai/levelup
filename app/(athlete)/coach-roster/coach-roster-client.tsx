'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Copy, ExternalLink, Share2, Users } from 'lucide-react';
import { formatEST } from '@/lib/format-date';
import { formatPhoneForSmsPaste } from '@/lib/phone';
import { copyTextToClipboard } from '@/lib/copy-to-clipboard';
import type { CoachRosterEntry, NextSessionShare } from '@/lib/coach-roster';

function pasteDisplay(e164: string | null): string {
  if (!e164) return '—';
  return formatPhoneForSmsPaste(e164);
}

function linesForCopy(texts: (string | null)[]): string {
  const parts = texts
    .filter((t): t is string => Boolean(t && t.trim()))
    .map((t) => formatPhoneForSmsPaste(t))
    .filter((line) => line.length > 0);
  return [...new Set(parts)].join('\n');
}

function lineCount(multiline: string): number {
  if (!multiline.trim()) return 0;
  return multiline.split('\n').filter(Boolean).length;
}

export function CoachRosterClient({
  entries,
  nextSession,
}: {
  entries: CoachRosterEntry[];
  nextSession: NextSessionShare | null;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const flash = (key: string) => {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 2000);
  };

  const onCopy = async (key: string, text: string) => {
    if (!text.trim()) {
      window.alert('No number on file.');
      return;
    }
    const ok = await copyTextToClipboard(text);
    if (!ok) window.alert('Could not copy. Try again or copy manually.');
    else flash(key);
  };

  const allKidPhones = linesForCopy(entries.map((e) => e.kidPhone));
  const allParentPhones = linesForCopy(entries.map((e) => e.parentPhone));
  const allPhones = linesForCopy(
    entries.flatMap((e) => [e.kidPhone, e.parentPhone].filter(Boolean) as string[])
  );
  const nKids = lineCount(allKidPhones);
  const nParents = lineCount(allParentPhones);
  const nAll = lineCount(allPhones);

  const kidName = (e: CoachRosterEntry) =>
    [e.kidFirstName, e.kidLastName].filter(Boolean).join(' ').trim() || 'Wrestler';
  const parentName = (e: CoachRosterEntry) =>
    [e.parentFirstName, e.parentLastName].filter(Boolean).join(' ').trim() || 'Parent';

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Everyone who has booked a session with you (private, partner, or group).{' '}
        <span className="text-foreground font-medium">Kid / athlete cells are listed first</span> — copy those for
        texting wrestlers directly; parent numbers when you need a parent.
      </p>

      {nextSession && (
        <Card className="border-accent/30 bg-accent/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Share2 className="h-4 w-4 text-accent" />
              Share your next session
            </CardTitle>
            <CardDescription>
              {formatEST(new Date(nextSession.scheduledDatetime), 'EEEE, MMM d · h:mm a')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] touch-manipulation"
              onClick={() => onCopy('reg', nextSession.registrationUrl)}
            >
              {copiedKey === 'reg' ? <Check className="h-4 w-4 mr-1 text-emerald-500" /> : <Copy className="h-4 w-4 mr-1" />}
              {copiedKey === 'reg' ? 'Copied' : 'Copy registration link'}
            </Button>
            {nextSession.joinUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] touch-manipulation"
                onClick={() => onCopy('join', nextSession.joinUrl!)}
              >
                {copiedKey === 'join' ? <Check className="h-4 w-4 mr-1 text-emerald-500" /> : <Copy className="h-4 w-4 mr-1" />}
                {copiedKey === 'join' ? 'Copied' : 'Copy join / invite link'}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="min-h-[44px] touch-manipulation" asChild>
              <Link href={`/sessions/${nextSession.sessionId}`} prefetch={false}>
                <ExternalLink className="h-4 w-4 mr-1" />
                Open session
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            className="min-h-[44px] touch-manipulation bg-[#D4AF37] hover:bg-[#B8963C] text-black font-medium"
            disabled={!allKidPhones}
            onClick={() => onCopy('all-kids', allKidPhones)}
          >
            {copiedKey === 'all-kids' ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copiedKey === 'all-kids'
              ? 'Copied'
              : `Copy all kid / athlete #s${nKids ? ` (${nKids})` : ''}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] touch-manipulation"
            disabled={!allParentPhones}
            onClick={() => onCopy('all-parents', allParentPhones)}
          >
            {copiedKey === 'all-parents' ? <Check className="h-4 w-4 mr-1 text-emerald-500" /> : <Copy className="h-4 w-4 mr-1" />}
            {copiedKey === 'all-parents'
              ? 'Copied'
              : `Copy all parent #s${nParents ? ` (${nParents})` : ''}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] touch-manipulation"
            disabled={!allPhones}
            onClick={() => onCopy('all', allPhones)}
          >
            {copiedKey === 'all' ? <Check className="h-4 w-4 mr-1 text-emerald-500" /> : <Copy className="h-4 w-4 mr-1" />}
            {copiedKey === 'all'
              ? 'Copied'
              : `Copy kids + parents (unique)${nAll ? ` (${nAll})` : ''}`}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Bulk copy is one number per line; same number twice in the roster appears once. Only numbers stored in LevelUp
          are included.
        </p>
      </div>

      {entries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground text-sm space-y-2">
            <Users className="h-10 w-10 mx-auto opacity-50" />
            <p>No families yet. When parents book your sessions, they&apos;ll show up here.</p>
            <Link href="/coach-sessions/create" className="text-accent font-medium underline inline-block">
              Create a session
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => {
            const rowKey = e.youthWrestlerId;
            const rowCopy = linesForCopy([e.kidPhone, e.parentPhone]);
            return (
              <Card key={rowKey}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-foreground">{kidName(e)}</p>
                      <p className="text-sm text-muted-foreground">{parentName(e)}</p>
                      <p className="text-xs text-muted-foreground">
                        Last session: {formatEST(new Date(e.lastSessionAt), 'MMM d, yyyy')} · {e.sessionCount} session
                        {e.sessionCount !== 1 ? 's' : ''} with you
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm pt-1">
                        <span className="font-medium text-foreground">
                          Kid: <span className="font-mono">{pasteDisplay(e.kidPhone)}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Parent: <span className="font-mono text-foreground">{pasteDisplay(e.parentPhone)}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="min-h-[40px] touch-manipulation bg-[#D4AF37] hover:bg-[#B8963C] text-black"
                        disabled={!e.kidPhone}
                        onClick={() => onCopy(`k-${rowKey}`, e.kidPhone ? formatPhoneForSmsPaste(e.kidPhone) : '')}
                      >
                        {copiedKey === `k-${rowKey}` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        <span className="ml-1">Kid</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-[40px] touch-manipulation"
                        disabled={!e.parentPhone}
                        onClick={() => onCopy(`p-${rowKey}`, e.parentPhone ? formatPhoneForSmsPaste(e.parentPhone) : '')}
                      >
                        {copiedKey === `p-${rowKey}` ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        <span className="ml-1">Parent</span>
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="min-h-[40px] touch-manipulation"
                        disabled={!rowCopy}
                        onClick={() => onCopy(`r-${rowKey}`, rowCopy)}
                      >
                        {copiedKey === `r-${rowKey}` ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        <span className="ml-1">Kid + parent</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
