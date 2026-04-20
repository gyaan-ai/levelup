'use client';

import { Button } from '@/components/ui/button';
import { Smartphone } from 'lucide-react';
import { usePwaInstallOptional } from '@/components/pwa-install-provider';

/**
 * Header / marketing control that opens the shared PWA install dialog (Safari vs Chrome logic lives in {@link PwaInstallProvider}).
 */
export function AddToHomeScreen({ variant = 'default' }: { variant?: 'default' | 'toolbar' }) {
  const pwa = usePwaInstallOptional();
  if (!pwa?.showToolbarButton) return null;

  const { openDialog } = pwa;
  const isToolbar = variant === 'toolbar';

  return isToolbar ? (
    <button
      type="button"
      onClick={openDialog}
      className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md text-white hover:text-accent hover:bg-white/10 transition-colors"
      title="Add to home screen"
      aria-label="Add to home screen"
    >
      <Smartphone className="h-5 w-5 shrink-0" aria-hidden />
    </button>
  ) : (
    <Button
      variant="outline"
      size="lg"
      onClick={openDialog}
      className="gap-2 bg-white/10 border-white/40 text-white hover:bg-white hover:text-black min-h-[44px] touch-manipulation"
    >
      <Smartphone className="h-5 w-5" />
      Home screen shortcut
    </Button>
  );
}
