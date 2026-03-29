import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all duration-200",
  {
    variants: {
      variant: {
        // 默认标签 — 透明底，炭灰边框
        default: "bg-transparent text-[var(--text-secondary)] border border-[var(--charcoal)]/20",
        // 次要标签 — 柔和填充
        secondary: "bg-[var(--charcoal)]/8 text-[var(--text-secondary)] border border-transparent",
        // 轮廓标签
        outline: "bg-transparent text-[var(--text-muted)] border border-[var(--charcoal)]/15",
        // 成功标签
        success: "bg-[var(--success-soft)] text-[var(--success)] border border-[var(--success)]/20",
        // 危险标签
        destructive: "bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/20",
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
