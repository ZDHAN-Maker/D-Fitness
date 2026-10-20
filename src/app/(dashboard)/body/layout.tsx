import { BodyTabs } from "@/components/body/body-tabs";

export default function BodyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold md:text-4xl">Body</h1>
        <BodyTabs />
      </header>
      {children}
    </div>
  );
}
