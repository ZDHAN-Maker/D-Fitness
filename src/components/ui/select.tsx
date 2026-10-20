import * as React from "react";
import { cn } from "@/lib/utils";

/** Native <select>: best mobile UX (OS picker) and zero JS. */
const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-md border border-input bg-card px-3 text-base text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive md:text-sm",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export { Select };
