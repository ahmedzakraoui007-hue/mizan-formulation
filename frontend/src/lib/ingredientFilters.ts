export const DEFAULT_INGREDIENT_FILTER_STATUS = "Stock Actif";

export type IngredientFilterStatus = "Tous" | "Stock Actif" | "Base Inactive";

export function ingredientMatchesStatus(ingredient: { is_active?: boolean }, status: string) {
  if (status === "Stock Actif") return ingredient.is_active !== false;
  if (status === "Base Inactive") return ingredient.is_active === false;
  return true;
}
