import { describe, expect, it } from "vitest";
import { useTestApp } from "./harness.js";

const api = useTestApp();

async function profile() {
  const res = await api.post("/profiles", { mode: "fresh" });
  return res.json.profile.id as string;
}

const rotiDal = [
  { kind: "catalogue", foodId: "roti", quantity: 2, unit: "piece" },
  { kind: "catalogue", foodId: "dal_tadka", quantity: 1, unit: "katori" },
];
const homeCurry = {
  kind: "estimate",
  name: "Mom's curry",
  quantity: 1,
  unit: "katori",
  nutrition: { calories: 220, protein: 6, carbs: 12, fat: 15, fibre: 3, satFat: 4 },
};

type Saved = { id: string; name: string; calories: number; draft: { items: { kind: string }[] } };
const list = async (id: string) => (await api.get("/saved-meals", id)).json.meals as Saved[];

describe("saved meals", () => {
  it("starts empty", async () => {
    expect(await list(await profile())).toEqual([]);
  });

  it("saves a named meal with its kcal and a draft for review", async () => {
    const id = await profile();
    const res = await api.post("/saved-meals", { name: "  Usual lunch ", items: [...rotiDal, homeCurry] }, id);
    expect(res.status).toBe(201);
    const [meal] = await list(id);
    expect(meal).toMatchObject({ name: "Usual lunch", calories: 616 });
    expect(meal!.draft.items.map((i) => i.kind)).toEqual(["catalogue", "catalogue", "estimate"]);
  });

  it("lists the newest first", async () => {
    const id = await profile();
    await api.post("/saved-meals", { name: "First", items: rotiDal }, id);
    api.ctx.clock.set("2026-10-06T08:00:00Z");
    await api.post("/saved-meals", { name: "Second", items: rotiDal }, id);
    expect((await list(id)).map((m) => m.name)).toEqual(["Second", "First"]);
  });

  it("needs a name and at least one dish", async () => {
    const id = await profile();
    expect((await api.post("/saved-meals", { name: " ", items: rotiDal }, id)).status).toBe(400);
    expect((await api.post("/saved-meals", { name: "Empty", items: [] }, id)).status).toBe(400);
  });

  it("rejects foods Kimbo doesn't know", async () => {
    const id = await profile();
    const res = await api.post(
      "/saved-meals",
      { name: "Mystery", items: [{ kind: "catalogue", foodId: "nope", quantity: 1, unit: "piece" }] },
      id,
    );
    expect(res.status).toBe(400);
  });

  it("renames a saved meal", async () => {
    const id = await profile();
    const created = await api.post("/saved-meals", { name: "Lunch", items: rotiDal }, id);
    const res = await api.patch(`/saved-meals/${created.json.meal.id}`, { name: "Office lunch" }, id);
    expect(res.status).toBe(200);
    expect((await list(id)).map((m) => m.name)).toEqual(["Office lunch"]);
  });

  it("deletes a saved meal", async () => {
    const id = await profile();
    const created = await api.post("/saved-meals", { name: "Lunch", items: rotiDal }, id);
    expect((await api.del(`/saved-meals/${created.json.meal.id}`, id)).status).toBe(204);
    expect(await list(id)).toEqual([]);
  });

  it("keeps other people's saved meals out of reach", async () => {
    const mine = await profile();
    const theirs = await profile();
    const created = await api.post("/saved-meals", { name: "Theirs", items: rotiDal }, theirs);
    expect(await list(mine)).toEqual([]);
    expect((await api.patch(`/saved-meals/${created.json.meal.id}`, { name: "Mine now" }, mine)).status).toBe(404);
    expect((await api.del(`/saved-meals/${created.json.meal.id}`, mine)).status).toBe(404);
  });
});
