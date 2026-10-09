import { describe, expect, it } from "vitest";
import { useTestApp } from "./harness.js";

const api = useTestApp();

async function profile(diet: string | null = null) {
  const id = (await api.post("/profiles", { mode: "fresh" })).json.profile.id;
  await api.put(`/profiles/${id}/preferences`, { diet, barriers: [] }, id);
  return id;
}
const pair = async (id: string, foodIds: string[]) => (await api.post("/assistant/pairing", { foodIds }, id)).json.pairing;

describe("what goes with this meal", () => {
  it("a dal or curry on its own gets its classic staple: rajma → rice, chole → roti", async () => {
    const id = await profile();
    expect((await pair(id, ["rajma"])).food.id).toBe("white_rice");
    expect((await pair(id, ["chole"])).food.id).toBe("roti");
    expect((await pair(id, ["rajma"])).text).toBe("Rajma goes best with steamed rice. Add some to make it a meal.");
  });

  it("a full plate gets a side, and south Indian breakfasts get sambar", async () => {
    const id = await profile();
    expect((await pair(id, ["dal_tadka", "roti"])).food.id).toBe("curd");
    expect((await pair(id, ["idli"])).food.id).toBe("sambar");
  });

  it("never suggests what's already there, or what the diet rules out", async () => {
    const id = await profile("vegan");
    expect((await pair(id, ["dal_tadka", "roti"])).food.id).not.toMatch(/curd|raita/);
    expect(await pair(id, ["dal_tadka", "roti", "salad"])).toBeNull();
  });
});
