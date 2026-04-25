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

/** Safe for TSV / Sheets paste — strip tabs and newlines inside a cell. */
function tsvCell(s: string): string {
  return s.replace(/\t/g, ' ').replace(/\r?\n/g, ' ').trim();
}

function buildRosterTsv(entries: CoachRosterEntry[], formatSessionDate: (iso: string) => string): string {
  const header = [
    'Parent name',
    'Wrestler',
    'Parent email',
    'Parent phone',
    'Kid phone',
    'Last session',
    'Sessions with you',
  ].join('\t');
  const lines = entries.map((e) => {
    const parentNm = tsvCell(
      [e.parentFirstName, e.parentLastName].filter(Boolean).join(' ').trim() || 'Parent'
    );
    const kidNm = tsvCell(
      [e.kidFirstName, e.kidLastName].filter(Boolean).join(' ').trim() || 'Wrestler'
    );
    const pPhone = e.parentPhone ? formatPhoneForSmsPaste(e.parentPhone) : '';
    const kPhone = e.kidPhone ? formatPhoneForSmsPaste(e.kidPhone) : '';
    return [
      parentNm,
      kidNm,
      tsvCell(e.parentEmail),
      pPhone,
      kPhone,
      tsvCell(formatSessionDate(e.lastSessionAt)),
      String(e.sessionCount),
    ].join('\t');
  });
  return [header, ...lines].join('\n');
}

function uniqueParentEmails(entries: CoachRosterEntry[]): string {
  const byLower = new Map<string, string>();
  for (const e of entries) {
    const raw = e.parentEmail?.trim();
    if (!raw) continue;
    const low = raw.toLowerCase();
    if (!byLower.has(low)) byLower.set(low, raw);
  }
  return [...byLower.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })).join('\n');
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

  const onCopy = async (key: string, text: string, emptyMessage = 'Nothing to copy.') => {
    if (!text.trim()) {
      window.alert(emptyMessage);
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

  const tsvBlob = buildRosterTsv(entries, (iso) => formatEST(new Date(iso), 'MMM d, yyyy'));
  const emailsBlob = uniqueParentEmails(entries);
  const nUniqueEmails = emailsBlob ? emailsBlob.split('\n').length : 0;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm leading-relaxed">
        <span className="text-foreground font-medium">Every parent and wrestler</span> who has ever been on your session
        roster (private, partner, or group). Use copy buttons for weekly texts or emails about new sessions — phones are
        one per line; the table paste works in Google Sheets or Excel.
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
              onClick={() => onCopy('reg', nextSession.registrationUrl, 'No link to copy.')}
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
                onClick={() => onCopy('join', nextSession.joinUrl!, 'No link to copy.')}
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
            onClick={() => onCopy('all-kids', allKidPhones, 'No kid / athlete numbers on file.')}
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
            onClick={() => onCopy('all-parents', allParentPhones, 'No parent numbers on file.')}
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
            onClick={() => onCopy('all', allPhones, 'No phone numbers on file.')}
          >
            {copiedKey === 'all' ? <Check className="h-4 w-4 mr-1 text-emerald-500" /> : <Copy className="h-4 w-4 mr-1" />}
            {copiedKey === 'all'
              ? 'Copied'
              : `Copy kids + parents (unique)${nAll ? ` (${nAll})` : ''}`}
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-[44px] touch-manipulation"
            disabled={entries.length === 0}
            onClick={() => onCopy('tsv', tsvBlob, 'No roster rows yet.')}
          >
            {copiedKey === 'tsv' ? <Check className="h-4 w-4 mr-1 text-emerald-500" /> : <Copy className="h-4 w-4 mr-1" />}
            {copiedKey === 'tsv' ? 'Copied' : `Copy full list (Sheets / Excel)${entries.length ? ` (${entries.length})` : ''}`}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-[44px] touch-manipulation"
            disabled={!emailsBlob}
            onClick={() => onCopy('emails', emailsBlob, 'No parent emails on file yet.')}
          >
            {copiedKey === 'emails' ? <Check className="h-4 w-4 mr-1 text-emerald-500" /> : <Copy className="h-4 w-4 mr-1" />}
            {copiedKey === 'emails'
              ? 'Copied'
              : `Copy parent emails (unique)${nUniqueEmails ? ` (${nUniqueEmails})` : ''}`}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Phone bulk copy: one number per line; duplicates removed. Table: tab-separated header row + one row per
          wrestler (same parent with two kids appears twice). Emails: one address per line for BCC.
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
                        onClick={() =>
                          onCopy(`k-${rowKey}`, e.kidPhone ? formatPhoneForSmsPaste(e.kidPhone) : '', 'No kid number on file.')
                        }
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
                        onClick={() =>
                          onCopy(
                            `p-${rowKey}`,
                            e.parentPhone ? formatPhoneForSmsPaste(e.parentPhone) : '',
                            'No parent number on file.'
                          )
                        }
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
                        onClick={() => onCopy(`r-${rowKey}`, rowCopy, 'No numbers on file for this row.')}
                      >
                        {copiedKey === `r-${rowKey}` ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        <span className="ml-1">Kid + parent</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-[40px] touch-manipulation"
                        disabled={!e.parentEmail?.trim()}
                        onClick={() =>
                          onCopy(`e-${rowKey}`, e.parentEmail.trim(), 'No email for this parent.')
                        }
                      >
                        {copiedKey === `e-${rowKey}` ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        <span className="ml-1">Email</span>
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
