import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[var(--radius-full)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.06em] transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-white/70 text-[var(--ink-secondary)] border border-white/50 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
        secondary: "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/20",
        outline: "bg-transparent text-[var(--ink-muted)] border border-[var(--ink-ghost)]/50",
        success: "bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success)]/30",
        destructive: "bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/30"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

function Badge({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
