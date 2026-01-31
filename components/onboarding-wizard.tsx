'use client';

import * as React from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface OnboardingWizardProps {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  canGoNext?: boolean;
  isLoading?: boolean;
  nextLabel?: string;
  backLabel?: string;
  skipLabel?: string;
  showSkip?: boolean;
  children: React.ReactNode;
  wizardTitle?: string;
  wizardDescription?: string;
  className?: string;
}

export function OnboardingWizard({
  currentStep,
  totalSteps,
  onNext,
  onBack,
  onSkip,
  canGoNext = true,
  isLoading = false,
  nextLabel = 'Continue',
  backLabel = 'Back',
  skipLabel = 'Skip',
  showSkip = false,
  children,
  wizardTitle,
  wizardDescription,
  className,
}: OnboardingWizardProps) {
  return (
    <div className={cn('container mx-auto px-4 py-6 sm:py-8 max-w-xl', className)}>
      {/* Step dots - minimal, mobile-first */}
      <div className="flex justify-center gap-1.5 mb-8 sm:mb-10">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i <= currentStep ? 'w-6 bg-accent' : 'w-1.5 bg-muted-foreground/30'
            )}
          />
        ))}
      </div>

      {/* Header - show once, keep it short */}
      {wizardTitle && (
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-serif font-bold text-primary">{wizardTitle}</h1>
          {wizardDescription && (
            <p className="text-muted-foreground mt-0.5 text-sm">{wizardDescription}</p>
          )}
        </div>
      )}

      {/* Step content - one focus per screen */}
      <div className="min-h-[180px] animate-in fade-in duration-200">{children}</div>

      {/* Nav - sticky feel, touch-friendly */}
      <div className="mt-8 pt-6 border-t border-border flex flex-col-reverse sm:flex-row gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={currentStep === 0 || isLoading}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {backLabel}
        </Button>
        <div className="flex gap-3 flex-1 sm:justify-end">
          {showSkip && onSkip && (
            <Button type="button" variant="ghost" onClick={onSkip} disabled={isLoading}>
              {skipLabel}
            </Button>
          )}
          <Button
            type="button"
            onClick={onNext}
            disabled={!canGoNext || isLoading}
            className="flex-1 sm:flex-initial min-w-[120px]"
          >
            {isLoading ? '…' : nextLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
