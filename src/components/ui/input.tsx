import * as React from "react";
import { cn } from "../../lib/utils";

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--charcoal)]/15 bg-white px-4 py-2 text-[13px] text-[var(--text-primary)] shadow-[var(--shadow-card)] transition-all duration-200 outline-none placeholder:text-[var(--text-muted)] focus-visible:border-[var(--accent)] focus-visible:shadow-[0_0_0_3px_var(--accent-glow)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input };
