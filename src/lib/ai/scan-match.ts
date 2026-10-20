import type { FoodResult } from "@/features/nutrition/types";
import { refKey } from "@/features/nutrition/types";

/** Merge search results for several search terms into one ranked, de-duplicated candidate list (earlier term = better). */
export function mergeCandidates(perTerm: FoodResult[][], max = 4): FoodResult[] {
  const seen = new Set<string>();
  const out: FoodResult[] = [];
  const longest = Math.max(0, ...perTerm.map((l) => l.length));
  // Round-robin so the best hit of EVERY term gets a chance before the 2nd hit of the first term.
  for (let i = 0; i < longest && out.length < max; i++) {
    for (const list of perTerm) {
      const f = list[i];
      if (!f || seen.has(refKey(f))) continue;
      seen.add(refKey(f));
      out.push(f);
      if (out.length >= max) break;
    }
  }
  return out;
}
