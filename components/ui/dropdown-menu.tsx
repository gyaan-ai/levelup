'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils'; // assume utils has cn helper; if not adjust accordingly

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuContent = ({
  className,
  align = 'start',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-none',
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
);

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent };
