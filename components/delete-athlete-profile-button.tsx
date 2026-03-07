'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';

type Props = {
  athleteId: string;
  athleteName: string;
  isOwnProfile: boolean;
};

export function DeleteAthleteProfileButton({ athleteId, athleteName, isOwnProfile }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    const message = isOwnProfile
      ? `Permanently delete your coach profile? This cannot be undone. You will be signed out.`
      : `Permanently delete ${athleteName}'s profile? This cannot be undone.`;
    if (!confirm(message)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/athletes/${athleteId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (isOwnProfile) {
          window.location.href = '/';
        } else {
          router.push('/browse');
          router.refresh();
        }
      } else {
        alert(data.error || 'Failed to delete profile');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 pt-6 border-t border-border">
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
        disabled={loading}
        onClick={handleDelete}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Trash2 className="h-4 w-4 mr-2" />
        )}
        Delete profile
      </Button>
    </div>
  );
}
