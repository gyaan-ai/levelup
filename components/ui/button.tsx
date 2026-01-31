import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 min-h-[44px] touch-manipulation",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-black hover:bg-accent-hover shadow-lg hover:shadow-accent/50",
        outline:
          "border-2 border-accent text-accent hover:bg-accent hover:text-black transition-all",
        ghost: "hover:bg-accent-light/20 hover:text-accent",
        black: "bg-primary text-white hover:bg-primary/90 shadow-lg",
        premium:
          "bg-accent text-black hover:bg-accent-hover shadow-lg gold-glow-hover",
        destructive: "bg-red-500 text-white hover:bg-red-600",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        link: "text-primary underline-offset-4 hover:underline min-h-0",
      },
      size: {
        default: "h-11 min-h-[44px] py-2 px-4 sm:h-10 sm:min-h-0",
        sm: "h-10 min-h-[44px] px-3 sm:h-9 sm:min-h-0",
        lg: "h-12 min-h-[44px] px-8 text-base sm:min-h-0",
        xl: "h-14 min-h-[44px] px-10 text-lg font-bold sm:min-h-0",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px] sm:h-10 sm:w-10 sm:min-h-0 sm:min-w-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
