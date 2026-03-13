'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/use-auth';
import { LogOut } from 'lucide-react';

export function AccountSignOut() {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  return (
    <Button
      variant="outline"
      className="w-full min-h-[44px] touch-manipulation text-muted-foreground hover:text-destructive hover:border-destructive"
      onClick={handleSignOut}
    >
      <LogOut className="h-4 w-4 mr-2" />
      Sign out
    </Button>
  );
}
