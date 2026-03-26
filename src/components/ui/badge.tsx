import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#8e8477]/30",
  {
    variants: {
      variant: {
        default: "border-[#d9cfbf] bg-[#f0e8dc] text-[#635e56]",
        secondary: "border-[#e1ddd5] bg-[#f8f5ef] text-[#6b655d]",
        outline: "border-[#d8d1c7] bg-white/70 text-[#6b655d]",
        success: "border-[#cce2d7] bg-[#edf7f1] text-[#2f7b5b]"
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
