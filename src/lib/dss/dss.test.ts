import { describe, expect, it } from "vitest";
import { ahpWeights, buildPairwiseMatrix, judgmentsFromRatings, pairKey, sliderToSaaty } from "./ahp";
import { topsis } from "./topsis";

describe("AHP", () => {
  it("maps slider steps onto Saaty's 1–9 scale", () => {
    expect(sliderToSaaty(0)).toBe(1);
    expect(sliderToSaaty(8)).toBe(9);
    expect(sliderToSaaty(-8)).toBeCloseTo(1 / 9);
  });

  it("gives equal weights and zero inconsistency for neutral judgments", () => {
    const r = ahpWeights(buildPairwiseMatrix(4, {}));
    r.weights.forEach((w) => expect(w).toBeCloseTo(0.25));
    expect(r.cr).toBeCloseTo(0);
    expect(r.consistent).toBe(true);
  });

  it("weights sum to 1 and favour the preferred criterion", () => {
    const m = buildPairwiseMatrix(3, { [pairKey(0, 1)]: 2, [pairKey(0, 2)]: 4, [pairKey(1, 2)]: 1 });
    const r = ahpWeights(m);
    expect(r.weights.reduce((s, w) => s + w, 0)).toBeCloseTo(1);
    expect(r.weights[0]).toBeGreaterThan(r.weights[1]!);
    expect(r.weights[1]).toBeGreaterThan(r.weights[2]!);
  });

  it("flags inconsistent judgments (CR ≥ 0.1)", () => {
    // A ≫ B, B ≫ C but C ≫ A — circular
    const m = buildPairwiseMatrix(3, { [pairKey(0, 1)]: 8, [pairKey(1, 2)]: 8, [pairKey(0, 2)]: -8 });
    expect(ahpWeights(m).consistent).toBe(false);
  });

  it("presets produce acceptably consistent matrices", () => {
    const r = ahpWeights(buildPairwiseMatrix(7, judgmentsFromRatings([9, 3, 2, 2, 2, 6, 5])));
    expect(r.cr).toBeLessThan(0.1);
  });
});

describe("TOPSIS", () => {
  it("ranks the alternative that is best on every criterion first", () => {
    // criteria: price (cost), performance (benefit)
    const res = topsis(
      [
        [100, 90],
        [200, 50],
        [150, 70],
      ],
      [0.5, 0.5],
      ["cost", "benefit"],
    );
    expect(res.scores[0]).toBeCloseTo(1);
    expect(res.scores[1]).toBeCloseTo(0);
    expect(res.scores[2]).toBeGreaterThan(0);
    expect(res.scores[2]).toBeLessThan(1);
  });

  it("weights change the winner", () => {
    const m = [
      [100, 50], // cheap, slow
      [200, 90], // expensive, fast
    ];
    const priceFirst = topsis(m, [0.9, 0.1], ["cost", "benefit"]);
    const perfFirst = topsis(m, [0.1, 0.9], ["cost", "benefit"]);
    expect(priceFirst.scores[0]).toBeGreaterThan(priceFirst.scores[1]!);
    expect(perfFirst.scores[1]).toBeGreaterThan(perfFirst.scores[0]!);
  });
});
