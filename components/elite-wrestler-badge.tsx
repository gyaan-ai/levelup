import { Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface EliteWrestlerBadgeProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function EliteWrestlerBadge({
  className,
  size = "md",
}: EliteWrestlerBadgeProps) {
  const sizeClasses = {
    sm: "px-2 py-1 text-xs gap-1",
    md: "px-3 py-1.5 text-sm gap-2",
    lg: "px-4 py-2 text-base gap-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center bg-primary text-white rounded-full border-2 border-accent font-semibold",
        sizeClasses[size],
        className
      )}
    >
      <Award className={cn("text-accent", iconSizes[size])} />
      <span>Elite Wrestler</span>
    </div>
  );
}
