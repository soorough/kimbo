import { assessTimeline } from "@kimbo/shared";
import { describe, expect, it } from "vitest";

/** 70 kg, 175 cm, 30 y male, lightly active: maintenance ≈ 2,270 kcal, so losing 1 kg a week (−1,100) would dip under 1,200. */
const body = { age: 30, sex: "male" as const, heightCm: 175, weightKg: 70, activity: "light" as const };

describe("is the goal date realistic?", () => {
  it("calls a gentle loss comfortable and picks the slowest pace that gets there in time", () => {
    // 3 kg in 12 weeks = 0.25 kg a week (0.36% of body weight)
    expect(assessTimeline({ ...body, goal: "lose", targetWeightKg: 67 }, 12)).toMatchObject({
      verdict: "comfortable",
      pace: 0.25,
      requiredKgPerWeek: 0.25,
    });
  });

  it("calls about 1% of body weight a week doable but effortful", () => {
    // 3 kg in 6 weeks = 0.5 kg a week (0.71% of body weight)
    expect(assessTimeline({ ...body, goal: "lose", targetWeightKg: 67 }, 6)).toMatchObject({
      verdict: "effort",
      pace: 0.5,
    });
  });

  it("flags losses above 1% of body weight a week as hard", () => {
    // 4.5 kg in 6 weeks = 0.75 kg a week (1.07%)
    expect(assessTimeline({ ...body, goal: "lose", targetWeightKg: 65.5 }, 6)).toMatchObject({
      verdict: "hard",
      pace: 0.75,
    });
  });

  it("says a date is unrealistic when no pace gets there, and offers what would work", () => {
    // 10 kg in 5 weeks = 2 kg a week
    const r = assessTimeline({ ...body, goal: "lose", targetWeightKg: 60 }, 5);
    expect(r.verdict).toBe("unrealistic");
    expect(r.pace).toBeNull();
    // fastest realistic pace for 70 kg is 0.5 kg (≤1% a week): 10 kg takes 20 weeks
    expect(r.realisticWeeks).toBe(20);
    // or, keeping the date, 5 weeks at 0.5 kg reaches 67.5 kg
    expect(r.realisticGoalWeightKg).toBe(67.5);
  });

  it("keeps a muscle gain slow: a quarter kilo a week is comfortable", () => {
    expect(assessTimeline({ ...body, goal: "build_muscle", targetWeightKg: 73 }, 12)).toMatchObject({
      verdict: "comfortable",
      pace: 0.25,
    });
  });

  it("warns that half a kilo a week of gain brings more fat", () => {
    expect(assessTimeline({ ...body, goal: "build_muscle", targetWeightKg: 73 }, 6)).toMatchObject({
      verdict: "effort",
      pace: 0.5,
    });
  });

  it("calls a faster gain unrealistic as muscle and suggests a slower date", () => {
    const r = assessTimeline({ ...body, goal: "build_muscle", targetWeightKg: 76 }, 6);
    expect(r.verdict).toBe("unrealistic");
    expect(r.realisticWeeks).toBe(12);
    expect(r.realisticGoalWeightKg).toBe(73);
  });

  it("never picks a pace that would need less than the safe minimum", () => {
    // 60 kg, 160 cm, 40 y woman, sitting: maintenance ≈ 1,490 kcal, so only 0.25 kg a week stays above 1,200
    const small = { age: 40, sex: "female" as const, heightCm: 160, weightKg: 60, activity: "sedentary" as const };
    const r = assessTimeline({ ...small, goal: "lose", targetWeightKg: 57 }, 4);
    expect(r.verdict).toBe("unrealistic");
    expect(r.realisticWeeks).toBe(12);
  });
});
