import * as React from "react";
import { cn } from "../../lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-[38px] w-full rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-sunken)] px-4 text-[13px] text-[var(--ink-primary)] transition-all duration-150 ease-out placeholder:text-[var(--ink-ghost)] focus:border-[var(--border-strong)] focus:bg-[var(--bg-elevated)] focus:outline-none focus:ring-[3px] focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input };
