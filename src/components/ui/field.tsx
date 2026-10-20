import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
};

/** Label + control + hint/error, wired for screen readers via aria-describedby on the control. */
export function Field({ id, label, error, hint, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Props to spread on the control so it points at its hint/error text. */
export function fieldAria(id: string, error?: string, hint?: string) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}
