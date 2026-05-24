import { describe, expect, it } from "vitest";
import { buildSolverRecipes, countSelectedRecipes, getRecipeIds } from "./optimizationSelection";

const recipes = [
  {
    id: 1,
    name: "Master",
    versions: [
      { id: 2, parent_id: 1, name: "Master", version_tag: "V2" },
      { id: 3, parent_id: 1, name: "Master", version_tag: "V3" },
    ],
  },
  { id: 4, name: "Second", versions: [] },
];

describe("optimization selection workflow", () => {
  it("lists master and version ids for default deselection", () => {
    expect(getRecipeIds(recipes)).toEqual([1, 2, 3, 4]);
  });

  it("counts selected recipes from the unselected list", () => {
    expect(countSelectedRecipes(recipes, [1, 3])).toBe(2);
  });

  it("builds solver payload without UI-only fields", () => {
    const payload = buildSolverRecipes(recipes, [1, 3]);

    expect(payload).toHaveLength(2);
    expect(payload.map((recipe) => recipe.name)).toEqual(["Master", "Second"]);
    expect(payload.every((recipe) => !("id" in recipe) && !("versions" in recipe) && !("parent_id" in recipe))).toBe(true);
  });
});
