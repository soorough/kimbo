import { describe, expect, it } from "vitest";
import { defaultGoal, useTestApp } from "./harness.js";

const api = useTestApp();

async function freshProfile() {
  const res = await api.post("/profiles", { mode: "fresh" });
  expect(res.status).toBe(201);
  return res.json.profile.id as string;
}

describe("onboarding & goal", () => {
  it("creates an anonymous profile without login", async () => {
    const res = await api.post("/profiles", { mode: "fresh" });
    expect(res.status).toBe(201);
    expect(res.json.profile).toMatchObject({ isDemo: false, timezone: "Asia/Kolkata", goal: null });
    expect(res.json.profile.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("calculates a calorie target with Mifflin–St Jeor and explains it", async () => {
    const id = await freshProfile();
    // 10*70 + 6.25*175 - 5*30 + 5 = 1648.75 BMR; ×1.2 sedentary = 1978.5 → 1980
    const res = await api.put(`/profiles/${id}/goal`, defaultGoal, id);
    expect(res.status).toBe(200);
    expect(res.json.profile.goal).toMatchObject({ computedTarget: 1980, effectiveTarget: 1980, targetOverride: null });
    expect(res.json.profile.goal.explanation.join(" ")).toMatch(/1649/);
    expect(res.json.profile.goal.explanation.join(" ")).toMatch(/1\.2/);
  });

  it("returns the calculation as numbers so the app can show it visually", async () => {
    const id = await freshProfile();
    const lose = await api.put(`/profiles/${id}/goal`, { ...defaultGoal, goal: "lose" }, id);
    // 1648.75 BMR × 1.2 = 1978.5 maintenance; −500 to lose
    expect(lose.json.profile.goal.breakdown).toEqual({
      bmr: 1649,
      activityFactor: 1.2,
      maintenance: 1979,
      adjustment: -500,
      kgPerWeek: -0.45,
    });
    const gain = await api.put(`/profiles/${id}/goal`, { ...defaultGoal, goal: "gain" }, id);
    expect(gain.json.profile.goal.breakdown).toMatchObject({ adjustment: 300, kgPerWeek: 0.27 });
  });

  it("adjusts for lose and gain goals", async () => {
    const id = await freshProfile();
    const lose = await api.put(`/profiles/${id}/goal`, { ...defaultGoal, goal: "lose" }, id);
    expect(lose.json.profile.goal.computedTarget).toBe(1480);
    const gain = await api.put(`/profiles/${id}/goal`, { ...defaultGoal, goal: "gain" }, id);
    expect(gain.json.profile.goal.computedTarget).toBe(2280);
  });

  it("uses the female formula and activity multipliers", async () => {
    const id = await freshProfile();
    // 10*60 + 6.25*160 - 5*40 - 161 = 1239 BMR; ×1.55 moderate = 1920.45 → 1920
    const res = await api.put(
      `/profiles/${id}/goal`,
      { age: 40, sex: "female", heightCm: 160, weightKg: 60, activity: "moderate", goal: "maintain" },
      id,
    );
    expect(res.json.profile.goal.computedTarget).toBe(1920);
  });

  it("never suggests a target below the safe floor", async () => {
    const id = await freshProfile();
    // 10*40 + 6.25*145 - 5*60 - 161 = 845.25 BMR; ×1.2 = 1014 - 500 → clamped to 1200
    const res = await api.put(
      `/profiles/${id}/goal`,
      { age: 60, sex: "female", heightCm: 145, weightKg: 40, activity: "sedentary", goal: "lose" },
      id,
    );
    expect(res.json.profile.goal.computedTarget).toBe(1200);
  });

  it("respects a user-adjusted target and derives macro targets from it", async () => {
    const id = await freshProfile();
    const res = await api.put(`/profiles/${id}/goal`, { ...defaultGoal, targetOverride: 2000 }, id);
    expect(res.json.profile.goal).toMatchObject({ computedTarget: 1980, targetOverride: 2000, effectiveTarget: 2000 });
    // 20% protein / 50% carbs / 30% fat
    expect(res.json.profile.goal.targets).toEqual({ calories: 2000, protein: 100, carbs: 250, fat: 67, fibre: 30 });
  });

  it("rejects an adjusted target outside safe bounds", async () => {
    const id = await freshProfile();
    const res = await api.put(`/profiles/${id}/goal`, { ...defaultGoal, targetOverride: 900 }, id);
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ code: "VALIDATION_ERROR", retryable: false });
    expect(res.json.message).toMatch(/1200/);
  });

  it("rejects nonsensical biometrics with a clear message", async () => {
    const id = await freshProfile();
    const res = await api.put(`/profiles/${id}/goal`, { ...defaultGoal, heightCm: 0, age: 200 }, id);
    expect(res.status).toBe(400);
    expect(res.json.code).toBe("VALIDATION_ERROR");
    const paths = res.json.issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["heightCm", "age"]));
  });

  it("remembers the profile and goal on return", async () => {
    const id = await freshProfile();
    await api.put(`/profiles/${id}/goal`, defaultGoal, id);
    const res = await api.get(`/profiles/${id}`, id);
    expect(res.status).toBe(200);
    expect(res.json.profile.goal.effectiveTarget).toBe(1980);
  });

  it("does not let one device read another profile", async () => {
    const mine = await freshProfile();
    const theirs = await freshProfile();
    const res = await api.get(`/profiles/${theirs}`, mine);
    expect(res.status).toBe(404);
  });

  it("requires a profile id on profile-scoped requests", async () => {
    const id = await freshProfile();
    const res = await api.get(`/profiles/${id}`);
    expect(res.status).toBe(401);
    expect(res.json.code).toBe("PROFILE_REQUIRED");
  });
});
