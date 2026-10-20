import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-md border border-input bg-card px-3 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive md:text-sm",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
