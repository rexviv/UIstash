import * as React from "react";
import { cn } from "../../lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-xl border border-[#ddd6cc] bg-[#faf6ef] px-4 py-2 text-sm text-[#30332e] shadow-sm transition-[color,box-shadow,border-color] outline-none placeholder:text-[#9a9388] focus-visible:border-[#cfc3b3] focus-visible:ring-2 focus-visible:ring-[#8e8477]/20",
        className
      )}
      {...props}
    />
  );
}

export { Input };
