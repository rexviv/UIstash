import * as React from "react";
import { cn } from "../../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[112px] w-full resize-y border border-[#2a2a2a] bg-[#0a0a0a] px-4 py-3 font-mono text-[13px] leading-6 text-[#e8e8e8] transition-colors outline-none placeholder:text-[#555555] focus-visible:border-[#00ff88] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
