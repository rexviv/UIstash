import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium tracking-wide transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none active:scale-[0.97]",
  {
    variants: {
      variant: {
        // 主按钮 — Editorial Red
        default: "bg-[var(--accent)] text-white shadow-[0_2px_8px_rgba(232,93,76,0.2)] hover:bg-[var(--accent-hover)] hover:shadow-[0_4px_16px_rgba(232,93,76,0.3)] hover:-translate-y-0.5",
        // 次按钮 — 炭灰
        secondary: "bg-[var(--charcoal)] text-white hover:bg-[var(--charcoal-hover)] hover:-translate-y-0.5 active:scale-[0.97]",
        // 幽灵按钮 — 透明
        ghost: "bg-transparent text-[var(--text-secondary)] hover:bg-black/5 hover:text-[var(--text-primary)] active:scale-[0.97]",
        // 边框按钮
        outline: "bg-transparent text-[var(--text-primary)] border border-[var(--charcoal)]/20 hover:border-[var(--charcoal)]/40 hover:bg-black/5 active:scale-[0.97]",
        // 危险按钮
        destructive: "bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/20 hover:bg-[var(--danger)]/20 hover:-translate-y-0.5 active:scale-[0.97]",
      },
      size: {
        default: "h-[40px] rounded-[var(--radius-md)] px-5 py-2.5",
        sm: "h-[32px] rounded-[var(--radius-sm)] px-3.5 text-xs",
        lg: "h-[48px] rounded-[var(--radius-lg)] px-6 text-base",
        icon: "size-[36px] rounded-[var(--radius-md)]",
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
