export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex max-w-3xl flex-col gap-6">{children}</div>;
}
