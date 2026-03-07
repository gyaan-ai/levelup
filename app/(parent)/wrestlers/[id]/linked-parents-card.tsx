'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, Users, Unlink, Link2, Copy, Check } from 'lucide-react';

type ParentRow = { parentId: string; email: string; isPrimary: boolean };

export function LinkedParentsCard({
  youthWrestlerId,
  isPrimary,
  parents,
}: {
  youthWrestlerId: string;
  isPrimary: boolean;
  parents: ParentRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleAdd = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/youth-wrestlers/${youthWrestlerId}/parents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Could not add parent' });
        setLoading(false);
        return;
      }
      setMessage({ type: 'success', text: 'Added. They can log in and will see this wrestler on their dashboard.' });
      setEmail('');
      router.refresh();
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong' });
    }
    setLoading(false);
  };

  const handleCreateInviteLink = async () => {
    setInviteLoading(true);
    setMessage(null);
    setInviteUrl(null);
    try {
      const res = await fetch(`/api/youth-wrestlers/${youthWrestlerId}/invite-link`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Could not create link' });
        setInviteLoading(false);
        return;
      }
      setInviteUrl(data.url ?? null);
      if (data.url) setMessage({ type: 'success', text: 'Link created. Send it to the other parent; they sign up or log in and they’ll be linked.' });
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong' });
    }
    setInviteLoading(false);
  };

  const copyInviteLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnlinkSelf = async () => {
    if (!confirm('Remove your account from this wrestler? You will no longer see them on your dashboard.')) return;
    setUnlinking(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/youth-wrestlers/${youthWrestlerId}/parents`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Could not unlink' });
        setUnlinking(false);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong' });
      setUnlinking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Linked parents
        </CardTitle>
        <CardDescription>
          {isPrimary
            ? 'Other accounts that can see this wrestler and book sessions. They must have a parent account.'
            : 'You’re linked as a parent for this wrestler. You see the same profile and can book sessions.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="text-sm space-y-1.5">
          {parents.map((p) => (
            <li key={p.parentId} className="flex items-center gap-2">
              <span className="text-muted-foreground">{p.email}</span>
              {p.isPrimary && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded">Primary</span>
              )}
            </li>
          ))}
        </ul>
        {isPrimary && (
          <>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Other parent's email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="flex-1"
              />
              <Button onClick={handleAdd} disabled={loading} size="icon" title="Add parent">
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground mb-2">Or send a link so they can sign up and get linked automatically:</p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleCreateInviteLink} disabled={inviteLoading}>
                  <Link2 className="h-4 w-4 mr-2" />
                  {inviteLoading ? 'Creating…' : 'Create invite link'}
                </Button>
                {inviteUrl && (
                  <Button variant="ghost" size="sm" onClick={copyInviteLink}>
                    {copied ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? 'Copied' : 'Copy link'}
                  </Button>
                )}
              </div>
              {inviteUrl && (
                <p className="text-xs text-muted-foreground mt-2 break-all">{inviteUrl}</p>
              )}
            </div>
            {message && (
              <p className={message.type === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
                {message.text}
              </p>
            )}
          </>
        )}
        {!isPrimary && (
          <Button variant="outline" size="sm" onClick={handleUnlinkSelf} disabled={unlinking}>
            <Unlink className="h-4 w-4 mr-2" />
            Unlink my account from this wrestler
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
