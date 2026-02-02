'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Smartphone, X } from 'lucide-react';
import Image from 'next/image';

type InstallState = 'idle' | 'installable' | 'ios' | 'unsupported' | 'installed';

export function AddToHomeScreen() {
  const [state, setState] = useState<InstallState>('idle');
  const [deferredPrompt, setDeferredPrompt] = useState<{
    prompt: () => Promise<{ outcome: string }>;
  } | null>(null);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    // Register service worker for installability
    if ('serviceWorker' in navigator && !isRegistering) {
      setIsRegistering(true);
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, [isRegistering]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as { prompt: () => Promise<{ outcome: string }> });
      setState('installable');
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as { standalone?: boolean }).standalone) {
      setState('installed');
      return;
    }

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    if (isIos && isSafari && state === 'idle') {
      setState('ios');
    }
  }, [state]);

  const handleClick = async () => {
    if (state === 'installable' && deferredPrompt) {
      const { outcome } = await deferredPrompt.prompt();
      if (outcome === 'accepted') setState('installed');
    } else if (state === 'ios') {
      setShowIosModal(true);
    }
  };

  if (state !== 'installable' && state !== 'ios') return null;

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        onClick={handleClick}
        className="gap-2 bg-white/10 border-white/40 text-white hover:bg-white hover:text-black"
      >
        <Smartphone className="h-5 w-5" />
        Add to Home Screen
      </Button>

      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setShowIosModal(false)}>
          <div
            className="bg-black border-2 border-accent rounded-xl p-6 max-w-sm w-full text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowIosModal(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white p-1"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="flex justify-center mb-4">
              <Image src="/apple-touch-icon.png" alt="" width={64} height={64} className="rounded-xl" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Add to Home Screen</h3>
            <p className="text-white/80 text-sm mb-6">Tap the Share button below, then scroll and tap &quot;Add to Home Screen&quot;.</p>
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10">
                <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 5l-1.42 1.42-1.59-1.59V16h-2V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z" />
                </svg>
                <span className="text-white font-medium">Share</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
