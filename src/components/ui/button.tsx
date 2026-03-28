import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[8px] text-sm font-medium transition-all duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30",
  {
    variants: {
      variant: {
        default: "bg-[var(--ink-primary)] text-[var(--bg-base)] border border-transparent shadow-[var(--shadow-sm)] hover:bg-[#2d2c29] hover:shadow-[var(--shadow-md)]",
        secondary: "bg-transparent text-[var(--ink-secondary)] border border-[var(--border-default)] shadow-none hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)]",
        ghost: "bg-transparent text-[var(--ink-secondary)] border border-transparent shadow-none hover:bg-[var(--bg-subtle)]",
        outline: "bg-[var(--bg-elevated)] text-[var(--ink-primary)] border border-[var(--border-default)] shadow-[var(--shadow-sm)] hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)]",
        destructive: "bg-[var(--danger-soft)] text-[var(--danger)] border border-[rgba(180,74,58,0.15)] shadow-none hover:bg-[rgba(180,74,58,0.12)]"
      },
      size: {
        default: "h-[38px] px-4 py-2",
        sm: "h-[32px] rounded-[6px] px-3 text-xs",
        lg: "h-[44px] rounded-[10px] px-5",
        icon: "size-[32px] rounded-[8px]"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
