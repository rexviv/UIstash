import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 text-[11px] font-medium transition-colors duration-150",
  {
    variants: {
      variant: {
        default: "px-2.5 py-1 rounded-[20px] bg-[var(--bg-sunken)] text-[var(--ink-secondary)] border border-[var(--border-default)]",
        secondary: "px-2.5 py-1 rounded-[20px] bg-[var(--bg-sunken)] text-[var(--ink-tertiary)] border border-[var(--border-subtle)]",
        accent: "px-2.5 py-1 rounded-[20px] bg-[var(--accent-soft)] text-[var(--ink-primary)] border border-[rgba(196,168,130,0.2)]",
        success: "px-2.5 py-1 rounded-[20px] bg-[var(--success-soft)] text-[var(--success)] border border-[rgba(74,124,90,0.15)]",
        danger: "px-2.5 py-1 rounded-[20px] bg-[var(--danger-soft)] text-[var(--danger)] border border-[rgba(180,74,58,0.15)]"
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
