import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold tracking-wide transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-glow)] active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent)] text-white shadow-[0_2px_8px_rgba(124,106,240,0.25)] hover:bg-[var(--accent-hover)] hover:shadow-[0_4px_16px_rgba(124,106,240,0.35)] hover:-translate-y-0.5",
        secondary: "bg-white/60 text-[var(--ink-secondary)] border border-white/40 backdrop-blur-xl shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:bg-white/80 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:scale-[0.97]",
        ghost: "bg-transparent text-[var(--ink-secondary)] hover:bg-white/50 hover:text-[var(--ink-primary)] active:scale-[0.97]",
        outline: "bg-white/50 text-[var(--ink-secondary)] border border-white/40 backdrop-blur-xl shadow-[0_2px_6px_rgba(0,0,0,0.06)] hover:bg-white/80 hover:-translate-y-0.5 active:scale-[0.97]",
        destructive: "bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/20 hover:bg-[var(--danger)]/20 hover:-translate-y-0.5 active:scale-[0.97]"
      },
      size: {
        default: "h-[40px] rounded-[var(--radius-md)] px-5 py-2.5",
        sm: "h-[34px] rounded-[var(--radius-sm)] px-3.5 text-xs",
        lg: "h-[48px] rounded-[var(--radius-lg)] px-6 text-base",
        icon: "size-[38px] rounded-[var(--radius-md)]"
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
