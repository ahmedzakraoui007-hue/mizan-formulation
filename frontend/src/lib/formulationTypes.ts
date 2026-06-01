export interface ConstraintConfig {
  min?: number;
  max?: number;
  exact?: number;
}

export interface ResultIngredient {
  code?: string | null;
  name: string;
  tons: number;
  percentage: number;
}

export interface ShadowPrice {
  ingredient_code?: string | null;
  ingredient_name: string;
  current_price: number;
  target_price: number;
  difference: number;
}

export interface RecipeResult {
  code?: string | null;
  version_tag?: string | null;
  name: string;
  demand_tons: number;
  raw_tons: number;
  process_yield_percent: number;
  cost_tnd: number;
  bag_size_kg: number;
  cost_per_bag_tnd: number;
  ingredients: ResultIngredient[];
  nutrients: Record<string, number>;
  shadow_prices?: ShadowPrice[];
}

export interface MultiBlendResult {
  status: string;
  total_factory_cost_tnd: number;
  recipes: RecipeResult[];
  achieved_all?: boolean;
}
