import * as React from "react";
import { cn } from "../../lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 border border-[#2a2a2a] bg-[#0a0a0a] px-4 py-2 font-mono text-[13px] text-[#e8e8e8] transition-colors outline-none placeholder:text-[#555555] focus-visible:border-[#00ff88]",
        className
      )}
      {...props}
    />
  );
}

export { Input };
