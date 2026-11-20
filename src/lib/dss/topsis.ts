import type { CriterionType } from "./criteria";

export interface TopsisResult {
  scores: number[];
  distanceToIdeal: number[];
  distanceToAntiIdeal: number[];
  /** Position of each alternative on each criterion: 1 = ideal, 0 = anti-ideal. */
  positions: number[][];
}

export function topsis(
  matrix: number[][],
  weights: number[],
  types: CriterionType[],
): TopsisResult {
  const m = matrix.length;
  const n = weights.length;
  if (m === 0) return { scores: [], distanceToIdeal: [], distanceToAntiIdeal: [], positions: [] };

  const norms = Array.from({ length: n }, (_, j) =>
    Math.sqrt(matrix.reduce((s, row) => s + (row[j] ?? 0) ** 2, 0)),
  );
  const weighted = matrix.map((row) =>
    row.map((x, j) => (norms[j] ? (x / norms[j]!) * weights[j]! : 0)),
  );
  const ideal: number[] = [];
  const anti: number[] = [];
  for (let j = 0; j < n; j++) {
    const col = weighted.map((r) => r[j]!);
    const max = Math.max(...col);
    const min = Math.min(...col);
    ideal.push(types[j] === "cost" ? min : max);
    anti.push(types[j] === "cost" ? max : min);
  }
  const dPlus = weighted.map((r) => Math.sqrt(r.reduce((s, v, j) => s + (v - ideal[j]!) ** 2, 0)));
  const dMinus = weighted.map((r) => Math.sqrt(r.reduce((s, v, j) => s + (v - anti[j]!) ** 2, 0)));
  const scores = dPlus.map((dp, i) => {
    const dm = dMinus[i]!;
    return dp + dm === 0 ? 1 : dm / (dp + dm);
  });
  const positions = weighted.map((r) =>
    r.map((v, j) => {
      const span = ideal[j]! - anti[j]!;
      return span === 0 ? 1 : (v - anti[j]!) / span;
    }),
  );
  return { scores, distanceToIdeal: dPlus, distanceToAntiIdeal: dMinus, positions };
}
