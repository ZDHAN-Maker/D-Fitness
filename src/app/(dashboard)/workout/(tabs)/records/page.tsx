import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { RECORD_LABEL, listRecords } from "@/features/workout/records";
import { formatPace } from "@/lib/calculations/workout";
import type { RecordRow } from "@/features/workout/types";

export const metadata: Metadata = { title: "Personal records" };

const valueText = (r: RecordRow) => (r.record_type === "fastest_time" ? formatPace(r.value) : `${r.value} ${r.unit}`);

function group(rows: RecordRow[]) {
  const map = new Map<string, { subject: RecordRow["subject"]; rows: RecordRow[] }>();
  for (const r of rows) {
    const key = `${r.subject.kind}:${r.subject.id}`;
    const g = map.get(key) ?? { subject: r.subject, rows: [] };
    g.rows.push(r);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => a.subject.name.localeCompare(b.subject.name));
}

export default async function RecordsPage() {
  const rows = await listRecords();
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <Trophy className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 font-medium">No records yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Finish a workout or log a run and your bests are tracked automatically.</p>
      </div>
    );
  }
  const strength = group(rows.filter((r) => r.subject.kind === "exercise"));
  const cardio = group(rows.filter((r) => r.subject.kind === "activity"));

  const section = (title: string, groups: ReturnType<typeof group>) =>
    groups.length ? (
      <section aria-label={title} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <ul className="flex flex-col gap-3">
          {groups.map((g) => (
            <li key={`${g.subject.kind}:${g.subject.id}`} className="rounded-lg border bg-card p-4">
              <h3 className="font-display text-base font-semibold">
                {g.subject.kind === "exercise" ? <Link href={`/workout/exercises/${g.subject.id}`} className="hover:underline">{g.subject.name}</Link> : g.subject.name}
              </h3>
              <dl className="tabular mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                {g.rows.sort((a, b) => a.record_type.localeCompare(b.record_type)).map((r) => (
                  <div key={r.record_type}>
                    <dd className="text-base font-semibold">{valueText(r)}</dd>
                    <dt className="text-xs text-muted-foreground">{RECORD_LABEL[r.record_type] ?? r.record_type} · {r.achieved_on}</dt>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      {section("Strength", strength)}
      {section("Cardio & sport", cardio)}
    </div>
  );
}
