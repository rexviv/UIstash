import * as React from "react";
import { cn } from "../../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[100px] w-full rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-sunken)] px-4 py-3 text-[13px] leading-6 text-[var(--ink-primary)] transition-all duration-150 ease-out placeholder:text-[var(--ink-ghost)] focus:border-[var(--border-strong)] focus:bg-[var(--bg-elevated)] focus:outline-none focus:ring-[3px] focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-50 resize-none",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
