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
      setDeferredPrompt(e as unknown as { prompt: () => Promise<{ outcome: string }> });
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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied! Open Safari, paste the link, then tap the Share button (square with arrow) and choose Add to Home Screen.');
    } catch {
      alert('Open this page in Safari, then tap the Share button (square with arrow at the bottom) and choose Add to Home Screen.');
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
            <p className="text-white/80 text-sm mb-4">
              In Safari, tap the <strong>Share</strong> button (square with an arrow at the bottom center of the screen), then tap <strong>&quot;Add to Home Screen&quot;</strong>.
            </p>
            <p className="text-white/60 text-xs mb-6">
              If you&apos;re in another browser, copy the link below and open it in Safari first.
            </p>
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-accent text-black font-semibold hover:opacity-90 transition-opacity"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy link (for Safari)
            </button>
          </div>
        </div>
      )}
    </>
  );
}
