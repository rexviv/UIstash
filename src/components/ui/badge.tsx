import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.05em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-[#333333] bg-[#1a1a1a] text-[#e8e8e8]",
        secondary: "border-[#2a2a2a] bg-[#181818] text-[#888888]",
        outline: "border-[#2a2a2a] bg-transparent text-[#888888]",
        success: "border-[#00ff88] bg-[#0a1f14] text-[#00ff88]",
        destructive: "border-[#ff6b35] bg-[#1a0a08] text-[#ff6b35]"
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
