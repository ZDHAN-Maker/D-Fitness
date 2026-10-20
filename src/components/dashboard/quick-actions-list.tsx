import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { QUICK_ACTIONS, isAvailable } from "@/constants/navigation";
import { cn } from "@/lib/utils";

/** The five one-hand actions. Items whose module has not shipped yet render disabled, never as dead links. */
export function QuickActionsList({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-1", className)}>
      {QUICK_ACTIONS.map(({ label, description, href, icon: Icon, phase }) => {
        const body = (
          <>
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col text-left">
              <span className="text-sm font-medium">{label}</span>
              <span className="truncate text-xs text-muted-foreground">{description}</span>
            </span>
          </>
        );
        return (
          <li key={href}>
            {isAvailable({ phase }) ? (
              <Link href={href} onClick={onNavigate} className="flex min-h-14 items-center gap-3 rounded-md px-2 hover:bg-accent">
                {body}
              </Link>
            ) : (
              <div aria-disabled="true" className="flex min-h-14 items-center gap-3 rounded-md px-2 opacity-60">
                {body}
                <Badge variant="muted">Phase {phase}</Badge>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
