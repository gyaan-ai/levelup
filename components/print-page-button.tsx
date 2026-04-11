'use client';

import { Button } from '@/components/ui/button';

export function PrintPageButton() {
  return (
    <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => window.print()}>
      Print
    </Button>
  );
}
