import * as React from "react";
import { cn } from "../../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[112px] w-full rounded-xl border border-[#ddd6cc] bg-[#faf6ef] px-4 py-3 text-sm leading-6 text-[#30332e] shadow-sm transition-[color,box-shadow,border-color] outline-none placeholder:text-[#9a9388] focus-visible:border-[#cfc3b3] focus-visible:ring-2 focus-visible:ring-[#8e8477]/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
