import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e8477]/30 active:scale-[0.985]",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#635e56] text-[#fff6ed] shadow-[0_14px_24px_rgba(99,94,86,0.16)] hover:-translate-y-0.5 hover:bg-[#5b554d]",
        secondary: "border-[#d8d1c7] bg-white/80 text-[#5e584f] hover:-translate-y-0.5 hover:border-[#cbbfaf] hover:bg-[#faf6ef]",
        ghost: "border-transparent bg-transparent text-[#6a645b] hover:bg-[#f0ebe3]",
        outline: "border-[#d8d1c7] bg-[#f7f2ea] text-[#635e56] hover:-translate-y-0.5 hover:bg-[#efe7da]",
        destructive: "border-[#ebd3cc] bg-[#fff3f1] text-[#a7442e] hover:-translate-y-0.5 hover:bg-[#ffe9e5]"
      },
      size: {
        default: "h-11 px-4 py-2.5",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-2xl px-5",
        icon: "size-10 rounded-xl"
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
