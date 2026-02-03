'use client';

import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  badge?: number;
  hasNew?: boolean;
  newLabel?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  description,
  icon,
  defaultOpen = true,
  badge,
  hasNew = false,
  newLabel,
  action,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={`mb-6 overflow-hidden transition-all ${hasNew && !isOpen ? 'ring-2 ring-accent/20' : ''}`}>
      <CardHeader className="py-4">
        <div className="flex items-center justify-between gap-4">
          <div
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
            onClick={() => setIsOpen((prev) => !prev)}
            role="button"
            aria-expanded={isOpen}
          >
            {icon && (
              <div className="flex-shrink-0 text-primary relative">
                {icon}
                {hasNew && !isOpen && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg break-words">{title}</CardTitle>
                {badge !== undefined && badge > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-semibold text-white bg-accent rounded-full">
                    {badge}
                  </span>
                )}
                {hasNew && newLabel && !isOpen && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold text-white bg-red-500 rounded-full animate-pulse">
                    {newLabel}
                  </span>
                )}
              </div>
              {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {action && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
              >
                {action.label}
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen((prev) => !prev);
              }}
              aria-label={isOpen ? 'Collapse section' : 'Expand section'}
            >
              {isOpen ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isOpen && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}
