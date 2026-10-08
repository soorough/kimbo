import { describe, expect, it } from "vitest";
import { defaultGoal, useTestApp } from "./harness.js";

const api = useTestApp();

async function onboarded(prefs?: { diet: string | null; barriers: string[] }, name?: string) {
  const res = await api.post("/profiles", { mode: "fresh" });
  const id = res.json.profile.id as string;
  await api.put(`/profiles/${id}/goal`, { ...defaultGoal, goal: "lose" }, id);
  if (prefs) await api.put(`/profiles/${id}/preferences`, prefs, id);
  if (name) await api.put(`/profiles/${id}/name`, { name }, id);
  return id;
}
const ldlWatch = [{ marker: "ldl", value: 142, unit: "mg/dL" }];
const addReport = (id: string) =>
  api.post("/reports", { reportDate: "2026-10-01", source: "manual", markers: ldlWatch }, id);
const lunch = (id: string) =>
  api.post(
    "/meals",
    {
      mealType: "lunch",
      source: "text",
      items: [
        { kind: "catalogue", foodId: "roti", quantity: 2, unit: "piece" },
        { kind: "catalogue", foodId: "dal_tadka", quantity: 1, unit: "katori" },
      ],
    },
    id,
  );
const ask = (id: string, body: object) => api.post("/assistant/ask", body, id);

describe("Ask Kimbo", () => {
  it("greets by name and time, and offers three starter questions for the next meal", async () => {
    const id = await onboarded(undefined, "Asha");
    const res = await api.get("/assistant", id);
    expect(res.status).toBe(200);
    // The test clock is 1 pm IST: afternoon, and lunch is the next meal.
    expect(res.json.greeting.text).toMatch(/Good afternoon, Asha/);
    expect(res.json.suggestions.map((s: { question: string }) => s.question)).toEqual([
      "what_to_eat",
      "why_focus",
      "how_am_i_doing",
    ]);
    expect(res.json.suggestions[0].label).toBe("What should I eat for lunch?");
  });

  it("suggests dishes for the next meal that fit the diet and the focus, with a log action", async () => {
    const id = await onboarded({ diet: "vegetarian", barriers: [] });
    await addReport(id);
    await lunch(id);
    const res = await ask(id, { question: "what_to_eat" });
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.json.reply).toLowerCase();
    // Lunch is logged, so the next meal is the snack; a vegetarian never gets meat or eggs.
    expect(res.json.reply.text).toMatch(/^For a snack/);
    expect(text).not.toMatch(/chicken|fish|mutton|egg/);
    expect(res.json.reply.actions).toEqual([{ kind: "log_meal", label: "Log a snack", mealType: "snack" }]);
    expect(res.json.reply.points.length).toBeGreaterThan(0);
  });

  it("after a meal that helped, suggests the next meal from history first, within the calories left", async () => {
    const id = await onboarded();
    await addReport(id);
    const snack = (foodId: string, unit: string, date: string) =>
      api.post(
        "/meals",
        { mealType: "snack", source: "text", eatenAt: `${date}T11:00:00Z`, items: [{ kind: "catalogue", foodId, quantity: 1, unit }] },
        id,
      );
    // Sprouts twice, samosa three times: samosa is eaten more, but it works against the fibre focus.
    await snack("sprouts", "katori", "2026-10-03");
    await snack("sprouts", "katori", "2026-10-05");
    for (const d of ["2026-10-02", "2026-10-04", "2026-10-05"]) await snack("samosa", "piece", d);
    await lunch(id);

    const home = await api.get("/assistant", id);
    expect(home.json.greeting.mood).toBe("proud");
    expect(home.json.greeting.text).toMatch(/^One meal today already helped your focus\. For a snack, your usual sprouts salad \(~\d+ kcal\) fits the [\d,]+ left\.$/);

    const res = await ask(id, { question: "what_to_eat" });
    expect(res.json.reply.text).toMatch(/^For a snack, your usual sprouts salad works/);
    expect(res.json.reply.points[0]).toMatch(/^Sprouts salad · about \d+ kcal · eaten 2 times$/);
    expect(JSON.stringify(res.json.reply)).not.toMatch(/samosa/i);
  });

  it("with no history yet, the greeting suggests catalogue dishes for the next meal", async () => {
    const id = await onboarded();
    await addReport(id);
    await lunch(id);
    const home = await api.get("/assistant", id);
    expect(home.json.greeting.text).toMatch(/already helped your focus\. For a snack, try .+ \(~\d+ kcal of the [\d,]+ left\)\.$/);
  });

  it("explains the focus from the real report value, or asks for a report", async () => {
    const id = await onboarded();
    const none = await ask(id, { question: "why_focus" });
    expect(none.json.reply.actions[0]).toMatchObject({ kind: "open", screen: "report" });
    await addReport(id);
    const res = await ask(id, { question: "why_focus" });
    expect(res.json.reply.text).toMatch(/LDL cholesterol is 142 mg\/dL/);
    expect(res.json.reply.text).toMatch(/More fibre-rich meals/);
  });

  it("sums up the week from logged meals", async () => {
    const id = await onboarded();
    await addReport(id);
    await lunch(id);
    const res = await ask(id, { question: "how_am_i_doing" });
    expect(res.json.reply.points).toContain("1 of 2 days logged");
    expect(res.json.reply.points).toContain("1 of 1 meals helped your focus");
  });

  it("answers typed questions from the user's own facts, keeping moods safe", async () => {
    const id = await onboarded({ diet: "jain", barriers: ["busy"] }, "Asha");
    await addReport(id);
    api.ctx.coach.next = { text: "Moong dal and roti would be lovely.", points: ["Moong dal"], mood: "furious" };
    const res = await ask(id, {
      text: "what can I have for dinner?",
      history: [{ role: "user", text: "hi" }],
    });
    expect(res.status).toBe(200);
    expect(res.json.reply).toMatchObject({ text: "Moong dal and roti would be lovely.", mood: "happy" });
    expect(res.json.reply.actions[0]).toMatchObject({ kind: "log_meal" });
    const facts = api.ctx.coach.lastInput!.facts;
    expect(facts).toMatch(/Diet: jain/);
    expect(facts).toMatch(/LDL cholesterol 142 mg\/dL/);
    expect(facts).toMatch(/Daily target: \d+ kcal/);
    expect(api.ctx.coach.lastInput!.history).toEqual([{ role: "user", text: "hi" }]);
  });

  it("offers logging only when a typed question is about eating", async () => {
    const id = await onboarded();
    const res = await ask(id, { text: "I have a headache, what medicine should I take?" });
    expect(res.json.reply.actions).toEqual([]);
  });

  it("rejects an empty or very long question", async () => {
    const id = await onboarded();
    expect((await ask(id, { text: "   " })).status).toBe(400);
    expect((await ask(id, { text: "x".repeat(301) })).status).toBe(400);
  });

  it("speaks a reply as audio and turns a recording into text", async () => {
    const id = await onboarded();
    const speak = await api.ctx.app.inject({
      method: "GET",
      url: `/assistant/speak?text=${encodeURIComponent("Hello from Kimbo")}`,
      headers: { "x-profile-id": id },
    });
    expect(speak.statusCode).toBe(200);
    expect(speak.headers["content-type"]).toMatch(/audio\/mpeg/);
    expect(api.ctx.voice.spoken).toEqual(["Hello from Kimbo"]);
    const heard = await api.post("/assistant/listen", { audioBase64: "AAAA", mimeType: "audio/m4a" }, id);
    expect(heard.json).toEqual({ text: "what should I eat for dinner" });
  });
});
