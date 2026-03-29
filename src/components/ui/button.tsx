import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap border text-sm font-semibold tracking-wide transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00ff88] active:brightness-90",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#00ff88] text-[#080808] hover:bg-[#00cc6a]",
        secondary: "border-[#2a2a2a] bg-[#181818] text-[#e8e8e8] hover:border-[#3a3a3a] hover:bg-[#222222]",
        ghost: "border-transparent bg-transparent text-[#888888] hover:bg-[#181818] hover:text-[#e8e8e8]",
        outline: "border-[#00ff88] bg-[#181818] text-[#00ff88] hover:bg-[#0f2018]",
        destructive: "border-[#ff6b35] bg-[#1a0a08] text-[#ff6b35] hover:bg-[#220e0a]"
      },
      size: {
        default: "h-11 px-4 py-2.5",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-5 text-sm",
        icon: "size-10"
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
