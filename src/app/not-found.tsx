import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-sm text-muted-foreground">That page does not exist, or it ships in a later phase.</p>
      <Link href="/dashboard" className={buttonVariants()}>
        Go to dashboard
      </Link>
    </main>
  );
}
