import * as React from "react";
import { cn } from "../../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[100px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--charcoal)]/15 bg-white px-4 py-3 text-[13px] leading-6 text-[var(--text-primary)] shadow-[var(--shadow-card)] transition-all duration-200 outline-none placeholder:text-[var(--text-muted)] focus-visible:border-[var(--accent)] focus-visible:shadow-[0_0_0_3px_var(--accent-glow)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
