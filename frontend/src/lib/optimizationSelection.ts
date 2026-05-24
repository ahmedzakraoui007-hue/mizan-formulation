type RecipeLike = {
  id: number;
  parent_id?: number | null;
  versions?: RecipeLike[];
  [key: string]: unknown;
};

export function getRecipeIds(recipeList: RecipeLike[]) {
  return recipeList.flatMap((recipe) => [
    recipe.id,
    ...(recipe.versions || []).map((version) => version.id),
  ]);
}

export function countSelectedRecipes(recipeList: RecipeLike[], unselectedRecipeIds: number[]) {
  const unselected = new Set(unselectedRecipeIds);
  return getRecipeIds(recipeList).filter((id) => !unselected.has(id)).length;
}

export function toSolverRecipe(recipe: RecipeLike) {
  return Object.fromEntries(
    Object.entries(recipe).filter(([key]) => !["id", "parent_id", "versions"].includes(key)),
  );
}

export function buildSolverRecipes(recipeList: RecipeLike[], unselectedRecipeIds: number[]) {
  const unselected = new Set(unselectedRecipeIds);
  const flatRecipes: Record<string, unknown>[] = [];

  for (const master of recipeList) {
    if (!unselected.has(master.id)) flatRecipes.push(toSolverRecipe(master));
    for (const version of master.versions || []) {
      if (!unselected.has(version.id)) flatRecipes.push(toSolverRecipe(version));
    }
  }

  return flatRecipes;
}
