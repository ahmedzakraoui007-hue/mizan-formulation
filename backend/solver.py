from ortools.linear_solver import pywraplp


# ═══════════════════════════════════════════════════════════════════════
#  Single-Blend Solver  (backward compatible — unchanged)
# ═══════════════════════════════════════════════════════════════════════

def solve_least_cost_formulation(ingredients, constraints):
    solver = pywraplp.Solver.CreateSolver("GLOP")
    if not solver:
        raise Exception("Failed to create solver GLOP")

    n = len(ingredients)

    # x[i] = fraction of ingredient i  (0 – 1)
    x = {i: solver.NumVar(0, 1.0, f"x_{i}") for i in range(n)}

    # Total weight = 100 %
    solver.Add(sum(x[i] for i in range(n)) == 1.0)

    # Protein range
    total_protein = sum(ing.protein * x[i] for i, ing in enumerate(ingredients))
    solver.Add(total_protein >= constraints.min_protein)
    solver.Add(total_protein <= constraints.max_protein)

    # Fiber range
    total_fiber = sum(ing.fiber * x[i] for i, ing in enumerate(ingredients))
    solver.Add(total_fiber >= constraints.min_fiber)
    solver.Add(total_fiber <= constraints.max_fiber)

    # Energy min
    total_energy = sum(ing.energy * x[i] for i, ing in enumerate(ingredients))
    solver.Add(total_energy >= constraints.min_energy)

    # Objective: minimise cost / kg
    objective = solver.Objective()
    for i, ing in enumerate(ingredients):
        objective.SetCoefficient(x[i], ing.cost)
    objective.SetMinimization()

    status = solver.Solve()
    if status != pywraplp.Solver.OPTIMAL:
        raise Exception("No feasible solution — constraints too tight.")

    recipe = []
    for i, ing in enumerate(ingredients):
        frac = x[i].solution_value()
        if frac > 1e-4:
            recipe.append({"name": ing.name, "percentage": round(frac * 100, 2)})

    cost_per_kg = objective.Value()
    achieved_protein = sum(ing.protein * x[i].solution_value() for i, ing in enumerate(ingredients))
    achieved_fiber   = sum(ing.fiber   * x[i].solution_value() for i, ing in enumerate(ingredients))
    achieved_energy  = sum(ing.energy  * x[i].solution_value() for i, ing in enumerate(ingredients))

    return {
        "status": "Optimal",
        "recipe": recipe,
        "cost_per_ton": round(cost_per_kg * 1000, 2),
        "nutrients": {
            "protein": round(achieved_protein, 2),
            "fiber":   round(achieved_fiber, 2),
            "energy":  round(achieved_energy, 0),
        },
    }


# ═══════════════════════════════════════════════════════════════════════
#  Multi-Blend Solver  (with Yield & Exact Targets)
#  ─────────────────────────────────────────────────────────────────────
#  Variables:   x[r][i]  ≥ 0    tons of RAW ingredient i for recipe r
#  Objective:   min  Σ_r Σ_i  cost_i_per_ton × x[r][i]
#
#  C1 Demand (yield-adjusted):
#     ∀ r:  Σ_i x[r][i] × (yield_r / 100)  =  demand_r
#     → The factory must load MORE raw material if yield < 100%
#
#  C2 Global Inventory:
#     ∀ i:  Σ_r x[r][i]  ≤  inventory_i
#
#  C3 Nutrition (per recipe):
#     If target_X is set  → exact equality on raw-material basis
#     Otherwise           → min/max range on raw-material basis
#
#     Raw-material basis means:
#       Nutrient concentration = Σ(nutrient_i × x[r][i]) / Σ(x[r][i])
#       Since Σ x[r][i] = demand_r / (yield_r/100) = raw_tons_r,
#       we linearise:  target × raw_tons  = Σ(nutrient_i × x[r][i])
# ═══════════════════════════════════════════════════════════════════════

def solve_multi_blend(ingredients, recipes):
    solver = pywraplp.Solver.CreateSolver("GLOP")
    if not solver:
        raise Exception("Failed to create GLOP solver")

    n_recipes = len(recipes)
    n_ings    = len(ingredients)

    # ── Decision variables ──────────────────────────────────────────
    # x[r][i] = tons of RAW ingredient i loaded for recipe r
    x = {}
    for r in range(n_recipes):
        for i in range(n_ings):
            upper = ingredients[i].inventory_limit_tons
            x[r, i] = solver.NumVar(0, upper, f"x_{r}_{i}")

    # ── Objective: minimise total purchasing cost ───────────────────
    objective = solver.Objective()
    for r in range(n_recipes):
        for i in range(n_ings):
            base_cost = ingredients[i].cost
            t_cost = getattr(ingredients[i], 'transport_cost', 0.0)
            landed_cost_per_ton = (base_cost + t_cost) * 1000
            objective.SetCoefficient(x[r, i], landed_cost_per_ton)
    objective.SetMinimization()

    # ── C1  Demand (yield-adjusted) ────────────────────────────────
    # raw_input × (yield/100) = finished_output
    # → Σ x[r,i] = demand_r / (yield_r / 100)
    for r in range(n_recipes):
        yld = getattr(recipes[r], 'process_yield_percent', 100.0) or 100.0
        raw_tons_needed = recipes[r].demand_tons / (yld / 100.0)
        solver.Add(
            sum(x[r, i] for i in range(n_ings)) == raw_tons_needed
        )

    # ── C2  Global inventory ───────────────────────────────────────
    for i in range(n_ings):
        solver.Add(
            sum(x[r, i] for r in range(n_recipes)) <= ingredients[i].inventory_limit_tons
        )

    # ── C3  Per-recipe nutritional constraints ───────────────
    for r, rec in enumerate(recipes):
        yld = getattr(rec, 'process_yield_percent', 100.0) or 100.0
        raw_tons = rec.demand_tons / (yld / 100.0)

        # Set of exact ingredient names to distinguish ingredient constraints from nutritional constraints
        ing_names = {ing.name: i for i, ing in enumerate(ingredients)}

        # Loop over every constrained parameter (can be a nutrient OR an ingredient) defined in the recipe
        for key, limit in rec.constraints.items():
            
            if key in ing_names:
                # ── INGREDIENT INCLUSION CONSTRAINT (Percentage) ──
                i = ing_names[key]
                # limit.min and limit.max are expressed as percentages (e.g., 60 for 60%).
                # raw_tons is the total weight basis.
                if limit.exact is not None:
                    solver.Add(x[r, i] == (limit.exact / 100.0) * raw_tons)
                else:
                    if limit.min is not None:
                        solver.Add(x[r, i] >= (limit.min / 100.0) * raw_tons)
                    if limit.max is not None:
                        solver.Add(x[r, i] <= (limit.max / 100.0) * raw_tons)
            
            else:
                # ── NUTRITIONAL CONSTRAINT ──
                # Linear expression for the total amount of this nutrient from all ingredients
                nutr_expr = sum(ingredients[i].nutrients.get(key, 0.0) * x[r, i] for i in range(n_ings))
                
                # Use exact target if provided
                if limit.exact is not None:
                    solver.Add(nutr_expr == limit.exact * raw_tons)
                else:
                    if limit.min is not None:
                        solver.Add(nutr_expr >= limit.min * raw_tons)
                    if limit.max is not None:
                        solver.Add(nutr_expr <= limit.max * raw_tons)

    # ── Solve ──────────────────────────────────────────────────────
    status = solver.Solve()
    if status != pywraplp.Solver.OPTIMAL:
        raise Exception(
            "Pas de solution réalisable — les contraintes de stock, "
            "rendement ou nutrition sont trop restrictives."
        )

    # ── Build response ─────────────────────────────────────────────
    total_cost = objective.Value()
    result_recipes = []

    for r, rec in enumerate(recipes):
        yld = getattr(rec, 'process_yield_percent', 100.0) or 100.0
        raw_tons = rec.demand_tons / (yld / 100.0)
        D = rec.demand_tons
        recipe_cost = 0.0
        ing_list = []
        shadow_prices = []

        for i, ing in enumerate(ingredients):
            tons = x[r, i].solution_value()
            base_cost = ing.cost
            t_cost = getattr(ing, 'transport_cost', 0.0)
            
            if tons > 1e-4:
                item_cost = tons * (base_cost + t_cost) * 1000
                recipe_cost += item_cost
                ing_list.append({
                    "name": ing.name,
                    "tons": round(tons, 4),
                    "percentage": round((tons / raw_tons) * 100, 2),
                })
            else:
                # Ingredient was rejected. Calculate its shadow price (Prix d'Intérêt)
                rc = x[r, i].reduced_cost()
                rc_per_kg = abs(rc) / 1000.0  # Objective function was scaled to per-ton (x 1000)
                
                if rc_per_kg > 0.001:
                    current_price = base_cost + t_cost
                    target_price = current_price - rc_per_kg
                    
                    if target_price > 0:
                        shadow_prices.append({
                            "ingredient_name": ing.name,
                            "current_price": round(current_price, 3),
                            "target_price": round(target_price, 3),
                            "difference": round(rc_per_kg, 3)
                        })

        # Achieved nutrients (dynamic)
        # We calculate the final average concentration of ALL nutrients explicitly present in ingredients
        achieved_nutrients = {}
        all_nutr_keys = set()
        for ing in ingredients:
            all_nutr_keys.update(ing.nutrients.keys())
            
        for nutr_key in all_nutr_keys:
            achieved = sum(ing.nutrients.get(nutr_key, 0.0) * x[r, i].solution_value() for i, ing in enumerate(ingredients)) / raw_tons
            achieved_nutrients[nutr_key] = round(achieved, 2)
            
        # Cost per bag
        bag_size_kg = getattr(rec, 'bag_size_kg', 50.0) or 50.0
        bags_produced = (D * 1000) / bag_size_kg
        cost_per_bag = recipe_cost / bags_produced

        result_recipes.append({
            "name": rec.name,
            "demand_tons": D,
            "raw_tons": round(raw_tons, 4),
            "process_yield_percent": yld,
            "cost_tnd": round(recipe_cost, 2),
            "bag_size_kg": bag_size_kg,
            "cost_per_bag_tnd": round(cost_per_bag, 2),
            "ingredients": ing_list,
            "nutrients": achieved_nutrients,
            "shadow_prices": shadow_prices,
        })

    return {
        "status": "Optimal",
        "total_factory_cost_tnd": round(total_cost, 2),
        "recipes": result_recipes,
        "achieved_all": True 
    }
