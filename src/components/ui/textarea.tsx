import * as React from "react";
import { cn } from "../../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[112px] w-full resize-y rounded-[var(--radius-md)] border border-white/40 bg-white/60 px-4 py-3 text-[13px] leading-6 text-[var(--ink-primary)] backdrop-blur-xl shadow-[0_2px_6px_rgba(0,0,0,0.06)] transition-all duration-200 outline-none placeholder:text-[var(--ink-muted)] focus-visible:border-[var(--accent)] focus-visible:shadow-[0_0_0_3px_var(--accent-glow)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
