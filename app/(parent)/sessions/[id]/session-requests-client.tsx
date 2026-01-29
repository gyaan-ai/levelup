'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

type YouthWrestlerInfo = {
  id: string;
  first_name: string;
  last_name: string;
  age?: number;
  weight_class?: string;
  skill_level?: string;
  school?: string;
} | null;

interface RequestItem {
  id: string;
  message?: string;
  status: string;
  created_at: string;
  youth_wrestlers: YouthWrestlerInfo;
}

/** Supabase can return youth_wrestlers as a single object or as an array from the relation. */
export type RawRequestItem = {
  id: string;
  message?: string;
  status: string;
  created_at: string;
  youth_wrestlers?: unknown;
};

function normalizeYouthWrestler(yw: unknown): YouthWrestlerInfo {
  if (Array.isArray(yw) && yw.length) return yw[0] as YouthWrestlerInfo;
  if (yw && typeof yw === 'object' && 'id' in (yw as object)) return yw as YouthWrestlerInfo;
  return null;
}

interface SessionRequestsClientProps {
  sessionId: string;
  initialRequests: RawRequestItem[];
}

export function SessionRequestsClient({
  sessionId,
  initialRequests,
}: SessionRequestsClientProps) {
  const [requests, setRequests] = useState<RequestItem[]>(() =>
    initialRequests.map((r) => ({ ...r, youth_wrestlers: normalizeYouthWrestler(r.youth_wrestlers) }))
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleResponse = async (requestId: string, action: 'approve' | 'decline') => {
    setLoadingId(requestId);
    try {
      const res = await fetch(`/api/session-join-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: action === 'approve' ? 'approved' : 'declined' } : r)));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoadingId(null);
    }
  };

  const pending = requests.filter((r) => r.status === 'pending');
  const resolved = requests.filter((r) => r.status !== 'pending');

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No join requests yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {pending.map((r) => {
        const yw = r.youth_wrestlers;
        const skillLabel = yw?.skill_level ? String(yw.skill_level).charAt(0).toUpperCase() + String(yw.skill_level).slice(1) : null;
        return (
          <Card key={r.id}>
            <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">{yw?.first_name} {yw?.last_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {yw?.age != null && `${yw.age} yrs`}
                    {yw?.weight_class && ` • ${yw.weight_class} lbs`}
                    {skillLabel && ` • ${skillLabel}`}
                    {yw?.school && ` • ${yw.school}`}
                  </p>
                </div>
              </div>
              <Badge variant="outline">Pending</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {r.message && (
                <div className="flex gap-2 text-sm">
                  <MessageSquare className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                  <p className="text-muted-foreground">{r.message}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Requested {format(new Date(r.created_at), 'MMM d, yyyy h:mm a')}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleResponse(r.id, 'decline')}
                  disabled={!!loadingId}
                >
                  {loadingId === r.id ? '…' : 'Decline'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleResponse(r.id, 'approve')}
                  disabled={!!loadingId}
                  className="bg-primary text-white"
                >
                  {loadingId === r.id ? '…' : 'Approve'}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {resolved.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Resolved</h2>
          <div className="space-y-3">
            {resolved.map((r) => {
              const yw = r.youth_wrestlers;
              return (
                <Card key={r.id}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <span className="font-medium">{yw?.first_name} {yw?.last_name}</span>
                    <Badge variant={r.status === 'approved' ? 'default' : 'secondary'}>
                      {r.status === 'approved' ? 'Approved' : 'Declined'}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
