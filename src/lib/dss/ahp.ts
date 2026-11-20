/**
 * Analytic Hierarchy Process (Saaty). Judgments use a slider value v in [-8, 8]:
 * v > 0 → row criterion is (v + 1)× more important, v < 0 → column criterion is.
 */
export const RANDOM_INDEX = [0, 0, 0, 0.58, 0.9, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49];

export type Judgments = Record<string, number>;

export const pairKey = (i: number, j: number) => `${i}-${j}`;

export function sliderToSaaty(v: number): number {
  const c = Math.max(-8, Math.min(8, Math.round(v)));
  return c >= 0 ? c + 1 : 1 / (1 - c);
}

export function buildPairwiseMatrix(n: number, judgments: Judgments): number[][] {
  const m = Array.from({ length: n }, () => Array<number>(n).fill(1));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = sliderToSaaty(judgments[pairKey(i, j)] ?? 0);
      m[i]![j] = a;
      m[j]![i] = 1 / a;
    }
  }
  return m;
}

export interface AhpResult {
  weights: number[];
  lambdaMax: number;
  ci: number;
  cr: number;
  consistent: boolean;
}

export function ahpWeights(matrix: number[][]): AhpResult {
  const n = matrix.length;
  const geo = matrix.map((row) => Math.pow(row.reduce((p, x) => p * x, 1), 1 / n));
  const sum = geo.reduce((s, x) => s + x, 0);
  const weights = geo.map((g) => g / sum);
  const aw = matrix.map((row) => row.reduce((s, x, j) => s + x * weights[j]!, 0));
  const lambdaMax = aw.reduce((s, x, i) => s + x / weights[i]!, 0) / n;
  const ci = n > 1 ? (lambdaMax - n) / (n - 1) : 0;
  const ri = RANDOM_INDEX[n] ?? 1.49;
  const cr = ri === 0 ? 0 : Math.max(0, ci / ri);
  return { weights, lambdaMax, ci, cr, consistent: cr < 0.1 };
}

/** Builds judgments from 1–9 importance ratings (used for presets). */
export function judgmentsFromRatings(ratings: number[]): Judgments {
  const j: Judgments = {};
  for (let a = 0; a < ratings.length; a++) {
    for (let b = a + 1; b < ratings.length; b++) {
      const ra = ratings[a]!;
      const rb = ratings[b]!;
      const ratio = ra >= rb ? ra / rb : rb / ra;
      const step = Math.min(8, Math.round(ratio) - 1);
      j[pairKey(a, b)] = ra >= rb ? step : -step;
    }
  }
  return j;
}

/** Normalises any non-negative weight vector to sum to 1. */
export function normalizeWeights(raw: number[]): number[] {
  const sum = raw.reduce((s, x) => s + Math.max(0, x), 0);
  if (sum === 0) return raw.map(() => 1 / raw.length);
  return raw.map((x) => Math.max(0, x) / sum);
}
