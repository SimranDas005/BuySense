import type { Product } from "../types";
import { CRITERIA, type Criterion } from "./criteria";
import { judgmentsFromRatings, type Judgments } from "./ahp";
import { topsis } from "./topsis";

export interface RankedLaptop {
  product: Product;
  rank: number;
  score: number;
  distanceToIdeal: number;
  distanceToAntiIdeal: number;
  positions: number[];
  strengths: Criterion[];
  weakness: Criterion | null;
  explanation: string;
}

export function rankLaptops(products: Product[], weights: number[], criteria = CRITERIA): RankedLaptop[] {
  const matrix = products.map((p) => criteria.map((c) => c.value(p)));
  const res = topsis(
    matrix,
    weights,
    criteria.map((c) => c.type),
  );
  const rows = products.map((product, i) => {
    const positions = res.positions[i] ?? [];
    const contrib = criteria.map((c, j) => ({ c, j, gain: weights[j]! * positions[j]!, pos: positions[j]! }));
    const strengths = [...contrib]
      .filter((x) => x.pos >= 0.6 && weights[x.j]! >= 0.05)
      .sort((a, b) => b.gain - a.gain)
      .slice(0, 2)
      .map((x) => x.c);
    const weakCandidate = [...contrib]
      .filter((x) => x.pos <= 0.4 && weights[x.j]! >= 0.08)
      .sort((a, b) => weights[b.j]! * (1 - b.pos) - weights[a.j]! * (1 - a.pos))[0];
    return {
      product,
      score: res.scores[i] ?? 0,
      distanceToIdeal: res.distanceToIdeal[i] ?? 0,
      distanceToAntiIdeal: res.distanceToAntiIdeal[i] ?? 0,
      positions,
      strengths,
      weakness: weakCandidate?.c ?? null,
    };
  });
  rows.sort((a, b) => b.score - a.score);
  return rows.map((r, idx) => ({
    ...r,
    rank: idx + 1,
    explanation: explain(r, idx + 1, weights, criteria),
  }));
}

function pct(w: number) {
  return `${Math.round(w * 100)}%`;
}

function explain(
  r: { product: Product; score: number; strengths: Criterion[]; weakness: Criterion | null },
  rank: number,
  weights: number[],
  criteria: Criterion[],
): string {
  const w = (c: Criterion) => weights[criteria.indexOf(c)] ?? 0;
  const parts: string[] = [];
  parts.push(`Ranked #${rank} with a closeness score of ${r.score.toFixed(3)}.`);
  if (r.strengths.length) {
    parts.push(
      `It stands out on ${r.strengths
        .map((c) => `${c.label.toLowerCase()} (${c.display(r.product)}, ${pct(w(c))} of your priorities)`)
        .join(" and ")}.`,
    );
  } else {
    parts.push("It is a balanced option without a single standout criterion.");
  }
  if (r.weakness) {
    parts.push(
      `Trade-off: ${r.weakness.label.toLowerCase()} is weaker than most alternatives (${r.weakness.display(r.product)}).`,
    );
  }
  return parts.join(" ");
}

export interface Preset {
  id: string;
  label: string;
  description: string;
  /** 1–9 importance ratings in CRITERIA order. */
  ratings: number[];
}

// CRITERIA order: price, performance, memory, storage, display, battery, portability
export const PRESETS: Preset[] = [
  { id: "balanced", label: "Balanced", description: "Every criterion matters equally", ratings: [1, 1, 1, 1, 1, 1, 1] },
  { id: "student", label: "Student", description: "Affordable, light, lasts all day", ratings: [9, 3, 2, 2, 2, 6, 5] },
  { id: "gamer", label: "Gamer", description: "Raw power and a fast screen", ratings: [3, 9, 5, 3, 6, 1, 1] },
  { id: "professional", label: "Professional", description: "Portable, reliable, long battery", ratings: [3, 5, 4, 3, 3, 8, 7] },
  { id: "creator", label: "Creator", description: "Performance, colour-accurate display, space", ratings: [2, 8, 6, 6, 8, 3, 2] },
];

export function presetJudgments(id: string): Judgments {
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0]!;
  return judgmentsFromRatings(p.ratings);
}
