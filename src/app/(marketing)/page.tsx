import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PILLARS = [
  { title: "Eat", text: "Search a real food database, log by gram or household portion, and see macros against your targets." },
  { title: "Train", text: "Build plans, log every set, and let personal records and progression surface on their own." },
  { title: "Recover", text: "Sleep, water, soreness and body weight sit next to training, so the trade-offs are visible." },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:px-8">
        <span className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-sm text-primary-foreground">OS</span>
          Personal Fitness OS
        </span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }))}>
            Sign in
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-14 px-4 py-14 md:px-8">
        <section className="max-w-2xl">
          <h1 className="text-balance text-3xl font-bold leading-tight sm:text-4xl md:text-6xl">Training, food and recovery in one log.</h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Everything you record stays private to your account, and every number on screen is calculated from what you actually logged.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className={cn(buttonVariants({ size: "lg" }))}>
              Create your account
            </Link>
            <Link href="/login" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
              Sign in
            </Link>
          </div>
        </section>

        <section aria-label="What it covers" className="grid gap-8 border-t pt-8 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title}>
              <h2 className="text-xl font-semibold">{p.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
