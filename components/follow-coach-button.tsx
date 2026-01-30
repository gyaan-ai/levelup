'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/use-auth';
import { Heart } from 'lucide-react';

type Props = { coachId: string; className?: string };

export function FollowCoachButton({ coachId, className }: Props) {
  const { user, userRole, loading: authLoading } = useAuth();
  const [following, setFollowing] = useState(false);
  const [checkLoading, setCheckLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);

  useEffect(() => {
    if (!user || userRole !== 'parent') {
      setCheckLoading(false);
      return;
    }
    let cancelled = false;
    setCheckLoading(true);
    fetch(`/api/coach-follows/check?coachId=${encodeURIComponent(coachId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && typeof d.following === 'boolean') setFollowing(d.following);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckLoading(false);
      });
    return () => { cancelled = true; };
  }, [user, userRole, coachId]);

  const onToggle = async () => {
    if (toggleLoading || !user) return;
    setToggleLoading(true);
    try {
      if (following) {
        const r = await fetch(`/api/coach-follows?coachId=${encodeURIComponent(coachId)}`, {
          method: 'DELETE',
        });
        if (r.ok) setFollowing(false);
      } else {
        const r = await fetch('/api/coach-follows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coachId }),
        });
        if (r.ok) setFollowing(true);
      }
    } finally {
      setToggleLoading(false);
    }
  };

  if (authLoading || !user || userRole !== 'parent') return null;
  if (checkLoading) {
    return (
      <Button variant="outline" size="sm" className={className} disabled>
        Follow
      </Button>
    );
  }

  return (
    <Button
      variant={following ? 'default' : 'outline'}
      size="sm"
      className={className}
      onClick={onToggle}
      disabled={toggleLoading}
    >
      <Heart
        className={`h-4 w-4 mr-1.5 ${following ? 'fill-current' : ''}`}
      />
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}
