import pytest

from main import MultiBlendIngredient, RecipeDemand
from solver import solve_multi_blend


def test_multi_blend_solver_respects_cost_and_stock():
    ingredients = [
        MultiBlendIngredient(
            name="Corn",
            cost=1.0,
            dm=88,
            inventory_limit_tons=20,
            nutrients={"Protein %": 8, "Energy": 3300},
        ),
        MultiBlendIngredient(
            name="Soy",
            cost=2.0,
            dm=89,
            inventory_limit_tons=20,
            nutrients={"Protein %": 46, "Energy": 2400},
        ),
    ]
    recipes = [
        RecipeDemand(
            name="Grower",
            demand_tons=10,
            constraints={"Protein %": {"min": 12}, "Energy": {"min": 2500}},
        )
    ]

    result = solve_multi_blend(ingredients, recipes)

    assert result["status"] == "Optimal"
    assert result["recipes"][0]["demand_tons"] == 10
    assert result["total_factory_cost_tnd"] > 0
    assert sum(item["tons"] for item in result["recipes"][0]["ingredients"]) == pytest.approx(10, abs=0.01)
    assert result["recipes"][0]["nutrients"]["Protein %"] >= 12


def test_multi_blend_solver_reports_infeasible_constraints():
    ingredients = [
        MultiBlendIngredient(
            name="Low protein",
            cost=1.0,
            dm=88,
            inventory_limit_tons=10,
            nutrients={"Protein %": 5},
        )
    ]
    recipes = [
        RecipeDemand(
            name="Impossible",
            demand_tons=10,
            constraints={"Protein %": {"min": 50}},
        )
    ]

    with pytest.raises(Exception, match="Pas de solution"):
        solve_multi_blend(ingredients, recipes)
