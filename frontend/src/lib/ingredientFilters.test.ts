import { describe, expect, it } from "vitest";
import { DEFAULT_INGREDIENT_FILTER_STATUS, ingredientMatchesStatus } from "./ingredientFilters";

describe("ingredient filtering workflow", () => {
  it("opens the ingredient page on active stock by default", () => {
    expect(DEFAULT_INGREDIENT_FILTER_STATUS).toBe("Stock Actif");
  });

  it("filters active, inactive and all ingredients", () => {
    expect(ingredientMatchesStatus({ is_active: true }, "Stock Actif")).toBe(true);
    expect(ingredientMatchesStatus({ is_active: false }, "Stock Actif")).toBe(false);
    expect(ingredientMatchesStatus({ is_active: false }, "Base Inactive")).toBe(true);
    expect(ingredientMatchesStatus({ is_active: false }, "Tous")).toBe(true);
  });
});
