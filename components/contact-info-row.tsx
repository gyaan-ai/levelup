'use client';

import { useState } from 'react';
import { Phone, Copy, Check, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyTextToClipboard } from '@/lib/copy-to-clipboard';
import { cn } from '@/lib/utils';

interface ContactInfoRowProps {
  label: string;
  name?: string;
  phone?: string | null;
  className?: string;
}

export function ContactInfoRow({ label, name, phone, className }: ContactInfoRowProps) {
  const [copied, setCopied] = useState(false);

  if (!phone) return null;

  // Format phone for display: (xxx) xxx-xxxx
  const formatPhone = (p: string) => {
    const digits = p.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return p;
  };

  // Get digits-only phone for SMS
  const getDigits = (p: string) => {
    const digits = p.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return digits.slice(1);
    }
    return digits;
  };

  const handleCopy = async () => {
    const digits = getDigits(phone);
    const success = await copyTextToClipboard(digits);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleText = () => {
    const digits = getDigits(phone);
    // On mobile, open SMS app; on desktop, copy and show message
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `sms:${digits}`;
    } else {
      // Copy and let them paste in their messaging app
      handleCopy();
    }
  };

  return (
    <div className={cn('flex items-center justify-between gap-2 py-1', className)}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="text-sm truncate">
          <span className="text-muted-foreground">{label}:</span>{' '}
          {name && <span className="font-medium">{name}</span>}
          {name && ' · '}
          <span className="font-mono text-xs">{formatPhone(phone)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 w-8 p-0 min-h-[44px] min-w-[44px] touch-manipulation"
          title="Copy phone number"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleText}
          className="h-8 w-8 p-0 min-h-[44px] min-w-[44px] touch-manipulation"
          title="Text this number"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Compact version for inline use
export function PhoneCopyButton({ phone, className }: { phone: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const getDigits = (p: string) => {
    const digits = p.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return digits.slice(1);
    }
    return digits;
  };

  const handleCopy = async () => {
    const digits = getDigits(phone);
    const success = await copyTextToClipboard(digits);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn('min-h-[44px] touch-manipulation', className)}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-1 text-emerald-500" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-4 w-4 mr-1" />
          Copy Phones
        </>
      )}
    </Button>
  );
}
