from __future__ import annotations

import copy
import unicodedata
from typing import Any

from solver import solve_multi_blend


def _get(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _set(obj: Any, key: str, value: Any) -> None:
    if isinstance(obj, dict):
        obj[key] = value
    else:
        setattr(obj, key, value)


def _bound(limit: Any, key: str) -> float | None:
    value = _get(limit, key)
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _set_bound(limit: Any, key: str, value: float | None) -> None:
    _set(limit, key, value)


def _constraints(recipe: Any) -> dict[str, Any]:
    return _get(recipe, "constraints", {}) or {}


def _norm(value: Any) -> str:
    text = str(value or "")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text.lower()


def _round(value: float, digits: int = 2) -> float:
    return round(float(value), digits)


def _clamp_score(score: float) -> int:
    return int(max(0, min(100, round(score))))


def _recipe_key(recipe: Any) -> str:
    return f"{_get(recipe, 'code', '')}|{_get(recipe, 'name', '')}"


def _result_recipe_key(recipe: dict[str, Any]) -> str:
    return f"{recipe.get('code') or ''}|{recipe.get('name') or ''}"


def _status_for_score(score: int) -> str:
    if score >= 85:
        return "good"
    if score >= 70:
        return "watch"
    return "risk"


def _score(label: str, value: float, detail: str) -> dict[str, Any]:
    score = _clamp_score(value)
    return {"label": label, "score": score, "status": _status_for_score(score), "detail": detail}


def _safe_div(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator else 0.0


def _total_usage_by_name(result: dict[str, Any]) -> dict[str, float]:
    usage: dict[str, float] = {}
    for recipe in result.get("recipes", []):
        for ingredient in recipe.get("ingredients", []):
            name = str(ingredient.get("name") or "")
            usage[name] = usage.get(name, 0.0) + float(ingredient.get("tons") or 0.0)
    return usage


def _cost_share_by_name(ingredients: list[Any], usage_by_name: dict[str, float]) -> dict[str, float]:
    costs: dict[str, float] = {}
    total = 0.0
    for ing in ingredients:
        name = str(_get(ing, "name", ""))
        tons = usage_by_name.get(name, 0.0)
        landed_cost = (float(_get(ing, "cost", 0.0) or 0.0) + float(_get(ing, "transport_cost", 0.0) or 0.0)) * 1000
        value = tons * landed_cost
        costs[name] = value
        total += value
    return {name: _safe_div(value, total) for name, value in costs.items()} if total else {}


def _nutrient_value(result_recipe: dict[str, Any], key: str) -> float | None:
    nutrients = result_recipe.get("nutrients", {}) or {}
    if key in nutrients:
        return float(nutrients[key])
    normalized = _norm(key)
    for nutrient_key, value in nutrients.items():
        if _norm(nutrient_key) == normalized:
            return float(value)
    return None


def _has_constraint_key(constraints: dict[str, Any], terms: list[str]) -> bool:
    normalized_terms = [_norm(term) for term in terms]
    return any(any(term in _norm(key) for term in normalized_terms) for key in constraints)


def _critical_missing(recipe: Any) -> list[str]:
    constraints = _constraints(recipe)
    species = _norm(_get(recipe, "species", "general"))
    required = [
        ("Proteine", ["proteine", "protein", "crude protein"]),
        ("Energie", ["energie", "energy", "amen", "kcal", "ufl"]),
    ]
    if any(term in species for term in ["volaille", "poultry", "broiler", "chicken"]):
        required.extend([
            ("Calcium", ["calcium", "ca %"]),
            ("Phosphore", ["phosphore", "phosphorus", "p %"]),
            ("Lysine", ["lysine"]),
            ("Methionine", ["methionine", "methionine"]),
        ])
    if any(term in species for term in ["ruminant", "bovin", "dairy", "cow"]):
        required.extend([
            ("Fibre", ["fibre", "fiber"]),
            ("Calcium", ["calcium", "ca %"]),
            ("Phosphore", ["phosphore", "phosphorus", "p %"]),
        ])
    return [label for label, terms in required if not _has_constraint_key(constraints, terms)]


def _constraint_tightness(recipe: Any, result_recipe: dict[str, Any], ingredient_names: set[str]) -> list[dict[str, Any]]:
    tight: list[dict[str, Any]] = []
    for key, limit in _constraints(recipe).items():
        if key in ingredient_names:
            continue
        achieved = _nutrient_value(result_recipe, key)
        if achieved is None:
            continue
        minimum = _bound(limit, "min")
        maximum = _bound(limit, "max")
        exact = _bound(limit, "exact")
        if exact is not None:
            tight.append({
                "key": key,
                "mode": "exact",
                "achieved": achieved,
                "target": exact,
                "slack": 0.0,
            })
            continue
        if minimum is not None:
            slack = achieved - minimum
            tolerance = max(abs(minimum) * 0.015, 0.05)
            if slack <= tolerance:
                tight.append({
                    "key": key,
                    "mode": "min",
                    "achieved": achieved,
                    "target": minimum,
                    "slack": slack,
                })
        if maximum is not None:
            slack = maximum - achieved
            tolerance = max(abs(maximum) * 0.015, 0.05)
            if slack <= tolerance:
                tight.append({
                    "key": key,
                    "mode": "max",
                    "achieved": achieved,
                    "target": maximum,
                    "slack": slack,
                })
    return tight


def _process_risks(result_recipe: dict[str, Any]) -> list[dict[str, Any]]:
    nutrients = result_recipe.get("nutrients", {}) or {}
    risks: list[dict[str, Any]] = []
    for key, value in nutrients.items():
        normalized = _norm(key)
        val = float(value or 0.0)
        if ("fibre" in normalized or "fiber" in normalized) and val > 8:
            risks.append({
                "label": "Fibre elevee",
                "detail": f"{result_recipe.get('name')} atteint {val:.2f} sur {key}; surveiller poussiere et tenue du granule.",
                "severity": "warning" if val < 12 else "critical",
            })
        if any(term in normalized for term in ["fat", "grasse", "lipide"]) and val > 5:
            risks.append({
                "label": "Matiere grasse elevee",
                "detail": f"{result_recipe.get('name')} atteint {val:.2f} sur {key}; risque de colmatage en granulation.",
                "severity": "warning",
            })
    return risks


def _try_solve(ingredients: list[Any], recipes: list[Any]) -> dict[str, Any] | None:
    try:
        solved = solve_multi_blend(ingredients, recipes)
        if solved.get("status") == "Optimal":
            return solved
    except Exception:
        return None
    return None


def _find_ingredient(ingredients: list[Any], name: str) -> Any | None:
    for ing in ingredients:
        if _get(ing, "name") == name:
            return ing
    return None


def _find_recipe_index(recipes: list[Any], result_recipe: dict[str, Any]) -> int | None:
    result_key = _result_recipe_key(result_recipe)
    for index, recipe in enumerate(recipes):
        if _recipe_key(recipe) == result_key:
            return index
    for index, recipe in enumerate(recipes):
        if _get(recipe, "name") == result_recipe.get("name"):
            return index
    return None


def _result_recipe_for(recipe: Any, result: dict[str, Any]) -> dict[str, Any] | None:
    source_key = _recipe_key(recipe)
    for item in result.get("recipes", []):
        if _result_recipe_key(item) == source_key:
            return item
    for item in result.get("recipes", []):
        if item.get("name") == _get(recipe, "name"):
            return item
    return None


def _validation(status: str, method: str) -> dict[str, str]:
    labels = {
        "validated": "Valide par GLOP",
        "simulation_only": "Simulation faisable",
        "data_check": "Controle donnees",
    }
    return {"status": status, "label": labels.get(status, status), "method": method}


def _build_shadow_price_recommendations(
    ingredients: list[Any],
    recipes: list[Any],
    result: dict[str, Any],
    usage_by_name: dict[str, float],
    max_items: int = 2,
) -> list[dict[str, Any]]:
    recommendations: list[dict[str, Any]] = []
    base_total = float(result.get("total_factory_cost_tnd") or 0.0)
    shadow_rows: list[dict[str, Any]] = []
    for recipe in result.get("recipes", []):
        for shadow in recipe.get("shadow_prices", []) or []:
            if shadow.get("target_price") is None or shadow.get("difference") is None:
                continue
            shadow_rows.append({**shadow, "recipe_name": recipe.get("name"), "recipe_code": recipe.get("code")})

    shadow_rows.sort(key=lambda row: float(row.get("difference") or 0.0))
    for shadow in shadow_rows[:4]:
        ingredient_name = str(shadow.get("ingredient_name") or "")
        target_price = float(shadow.get("target_price") or 0.0)
        if target_price <= 0:
            continue

        candidate_ingredients = copy.deepcopy(ingredients)
        candidate = _find_ingredient(candidate_ingredients, ingredient_name)
        if not candidate:
            continue
        transport = float(_get(candidate, "transport_cost", 0.0) or 0.0)
        _set(candidate, "cost", max(0.001, target_price - transport - 0.001))
        solved = _try_solve(candidate_ingredients, copy.deepcopy(recipes))
        if not solved:
            continue
        new_usage = _total_usage_by_name(solved).get(ingredient_name, 0.0)
        if new_usage <= usage_by_name.get(ingredient_name, 0.0) + 0.01:
            continue
        savings = base_total - float(solved.get("total_factory_cost_tnd") or base_total)
        recommendations.append({
            "type": "purchasing",
            "priority": "high" if savings > base_total * 0.01 else "medium",
            "title": f"Negociation validee: {ingredient_name}",
            "action": f"Demander un prix rendu <= {target_price:.3f} TND/kg pour {ingredient_name}.",
            "impact": f"Le solveur reutilise cette matiere a {new_usage:.2f} t. Gain estime: {max(0.0, savings):.2f} TND.",
            "ingredient_name": ingredient_name,
            "recipe_name": shadow.get("recipe_name"),
            "estimated_savings_tnd": _round(max(0.0, savings)),
            "validation": _validation("validated", "Prix cible rejoue dans GLOP avec les matieres actives et les stocks actuels."),
        })
        if len(recommendations) >= max_items:
            break
    return recommendations


def _build_stock_recommendations(
    ingredients: list[Any],
    recipes: list[Any],
    result: dict[str, Any],
    usage_by_name: dict[str, float],
    max_items: int = 2,
) -> list[dict[str, Any]]:
    recommendations: list[dict[str, Any]] = []
    base_total = float(result.get("total_factory_cost_tnd") or 0.0)
    tight_stock = []
    for ing in ingredients:
        name = str(_get(ing, "name", ""))
        stock = float(_get(ing, "inventory_limit_tons", 0.0) or 0.0)
        used = usage_by_name.get(name, 0.0)
        ratio = _safe_div(used, stock)
        if stock > 0 and ratio >= 0.9:
            tight_stock.append((ratio, used, stock, name))

    tight_stock.sort(reverse=True)
    for _ratio, used, stock, name in tight_stock[:max_items]:
        candidate_ingredients = copy.deepcopy(ingredients)
        candidate = _find_ingredient(candidate_ingredients, name)
        if not candidate:
            continue
        reserve = max(1.0, stock * 0.1)
        _set(candidate, "inventory_limit_tons", stock + reserve)
        solved = _try_solve(candidate_ingredients, copy.deepcopy(recipes))
        if not solved:
            continue
        savings = base_total - float(solved.get("total_factory_cost_tnd") or base_total)
        recommendations.append({
            "type": "supply",
            "priority": "high" if used >= stock * 0.98 else "medium",
            "title": f"Securiser le stock: {name}",
            "action": f"Ajouter au moins {reserve:.2f} t de marge disponible sur {name}.",
            "impact": (
                f"Le plan consomme {used:.2f}/{stock:.2f} t. "
                f"Simulation faisable avec marge; gain potentiel {max(0.0, savings):.2f} TND."
            ),
            "ingredient_name": name,
            "estimated_savings_tnd": _round(max(0.0, savings)),
            "validation": _validation("validated", "Stock augmente puis plan rejoue dans GLOP."),
        })
    return recommendations


def _build_constraint_recommendations(
    ingredients: list[Any],
    recipes: list[Any],
    result: dict[str, Any],
    ingredient_names: set[str],
    max_items: int = 2,
) -> list[dict[str, Any]]:
    recommendations: list[dict[str, Any]] = []
    base_total = float(result.get("total_factory_cost_tnd") or 0.0)
    candidates: list[tuple[float, int, str, str, float]] = []

    for index, recipe in enumerate(recipes):
        result_recipe = _result_recipe_for(recipe, result)
        if not result_recipe:
            continue
        for item in _constraint_tightness(recipe, result_recipe, ingredient_names):
            if item["mode"] not in {"min", "max"}:
                continue
            target = float(item["target"])
            achieved = float(item["achieved"])
            slack_ratio = abs(float(item["slack"])) / max(abs(target), 1.0)
            candidates.append((slack_ratio, index, str(item["key"]), str(item["mode"]), achieved))

    candidates.sort(key=lambda row: row[0])
    for _slack_ratio, recipe_index, key, mode, _achieved in candidates[:4]:
        candidate_recipes = copy.deepcopy(recipes)
        recipe = candidate_recipes[recipe_index]
        limit = _constraints(recipe).get(key)
        if not limit:
            continue
        current = _bound(limit, mode)
        if current is None or current <= 0:
            continue
        if mode == "min":
            new_value = max(0.0, current * 0.98)
            direction = "baisser"
        else:
            new_value = current * 1.02
            direction = "augmenter"
        _set_bound(limit, mode, new_value)
        solved = _try_solve(copy.deepcopy(ingredients), candidate_recipes)
        if not solved:
            continue
        savings = base_total - float(solved.get("total_factory_cost_tnd") or base_total)
        if savings <= max(5.0, base_total * 0.001):
            continue
        recipe_name = str(_get(recipes[recipe_index], "name", ""))
        recommendations.append({
            "type": "formulation",
            "priority": "medium",
            "title": f"Scenario formule: {key}",
            "action": f"Simuler {direction} {key} sur {recipe_name} de {current:.2f} a {new_value:.2f}.",
            "impact": f"Scenario mathematiquement faisable avec gain estime {savings:.2f} TND. A valider par le nutritionniste avant production.",
            "recipe_name": recipe_name,
            "estimated_savings_tnd": _round(savings),
            "validation": _validation("simulation_only", "Contrainte modifiee puis plan rejoue dans GLOP; validation nutrition requise."),
        })
        if len(recommendations) >= max_items:
            break
    return recommendations


def _first_relaxable_constraint(
    recipes: list[Any],
    result: dict[str, Any],
    ingredient_names: set[str],
) -> tuple[int, str, str, float] | None:
    for index, recipe in enumerate(recipes):
        result_recipe = _result_recipe_for(recipe, result)
        if result_recipe:
            tight = _constraint_tightness(recipe, result_recipe, ingredient_names)
            for item in tight:
                if item["mode"] in {"min", "max", "exact"}:
                    return index, str(item["key"]), str(item["mode"]), float(item["target"])

        for key, limit in _constraints(recipe).items():
            if key in ingredient_names:
                continue
            exact = _bound(limit, "exact")
            minimum = _bound(limit, "min")
            maximum = _bound(limit, "max")
            if exact is not None and exact > 0:
                return index, key, "exact", exact
            if minimum is not None and minimum > 0:
                return index, key, "min", minimum
            if maximum is not None and maximum > 0:
                return index, key, "max", maximum
    return None


def _apply_relaxed_constraint(limit: Any, mode: str, value: float) -> tuple[str, float]:
    if mode == "exact":
        _set_bound(limit, "exact", None)
        _set_bound(limit, "min", round(value * 0.985, 4))
        _set_bound(limit, "max", round(value * 1.015, 4))
        return "transformer la cible exacte en fourchette", value
    if mode == "min":
        new_value = round(max(0.0, value * 0.98), 4)
        _set_bound(limit, "min", new_value)
        return "baisser le minimum", new_value
    new_value = round(value * 1.02, 4)
    _set_bound(limit, "max", new_value)
    return "augmenter le maximum", new_value


def _build_precise_next_actions(
    ingredients: list[Any],
    recipes: list[Any],
    result: dict[str, Any],
    usage_by_name: dict[str, float],
    cost_shares: dict[str, float],
    ingredient_names: set[str],
    missing_nutrient_rows: list[str],
    process_risks: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    recommendations: list[dict[str, Any]] = []
    base_total = float(result.get("total_factory_cost_tnd") or 0.0)

    if cost_shares:
        top_cost_name, top_share = max(cost_shares.items(), key=lambda item: item[1])
        if top_share > 0 and usage_by_name.get(top_cost_name, 0.0) > 0:
            candidate_ingredients = copy.deepcopy(ingredients)
            candidate = _find_ingredient(candidate_ingredients, top_cost_name)
            source = _find_ingredient(ingredients, top_cost_name)
            if candidate and source:
                transport = float(_get(candidate, "transport_cost", 0.0) or 0.0)
                current_price = float(_get(candidate, "cost", 0.0) or 0.0) + transport
                target_price = round(current_price * 0.97, 4)
                _set(candidate, "cost", max(0.001, target_price - transport))
                solved = _try_solve(candidate_ingredients, copy.deepcopy(recipes))
                if solved:
                    savings = max(0.0, base_total - float(solved.get("total_factory_cost_tnd") or base_total))
                    recommendations.append({
                        "type": "purchasing",
                        "priority": "high" if top_share >= 0.35 else "medium",
                        "title": f"Action achat: {top_cost_name}",
                        "action": f"Demander une baisse de 3% sur {top_cost_name}: prix rendu cible {target_price:.3f} TND/kg.",
                        "impact": f"Cette matiere represente {top_share * 100:.1f}% du cout du plan. Simulation GLOP: gain estime {savings:.2f} TND.",
                        "ingredient_name": top_cost_name,
                        "estimated_savings_tnd": _round(savings),
                        "validation": _validation("validated", "Prix -3% rejoue dans GLOP avec les memes stocks et formules."),
                    })

    if usage_by_name:
        top_used_name, used = max(usage_by_name.items(), key=lambda item: item[1])
        source = _find_ingredient(ingredients, top_used_name)
        if source and used > 0:
            stock = float(_get(source, "inventory_limit_tons", 0.0) or 0.0)
            free_stock = max(0.0, stock - used)
            reserve = round(max(0.5, used * 0.03), 2)
            buy_qty = round(max(0.0, reserve - free_stock), 2)
            recommendations.append({
                "type": "supply",
                "priority": "high" if buy_qty > 0 else "medium",
                "title": f"Action stock: {top_used_name}",
                "action": (
                    f"Bloquer une reserve de securite de {reserve:.2f} t sur {top_used_name}. "
                    f"{'Acheter ' + format(buy_qty, '.2f') + ' t avant production.' if buy_qty > 0 else 'Stock libre suffisant, a reserver dans le silo.'}"
                ),
                "impact": f"Le plan consomme {used:.2f} t sur {stock:.2f} t disponibles; stock libre {free_stock:.2f} t.",
                "ingredient_name": top_used_name,
                "validation": _validation("data_check", "Controle stock calcule sur les quantites retenues par GLOP."),
            })

    relaxable = _first_relaxable_constraint(recipes, result, ingredient_names)
    if relaxable:
        recipe_index, key, mode, current = relaxable
        candidate_recipes = copy.deepcopy(recipes)
        limit = _constraints(candidate_recipes[recipe_index]).get(key)
        if limit:
            direction, new_value = _apply_relaxed_constraint(limit, mode, current)
            solved = _try_solve(copy.deepcopy(ingredients), candidate_recipes)
            recipe_name = str(_get(recipes[recipe_index], "name", ""))
            if solved:
                savings = max(0.0, base_total - float(solved.get("total_factory_cost_tnd") or base_total))
                recommendations.append({
                    "type": "formulation",
                    "priority": "medium",
                    "title": f"Action formule: {recipe_name}",
                    "action": f"Creer une variante test et {direction} de {key}: {current:.2f} -> {new_value:.2f}.",
                    "impact": f"Scenario faisable avec les matieres actives. Gain estime {savings:.2f} TND; valider nutrition avant adoption.",
                    "recipe_name": recipe_name,
                    "estimated_savings_tnd": _round(savings),
                    "validation": _validation("simulation_only", "Contrainte ajustee puis plan rejoue dans GLOP; validation nutrition requise."),
                })

    if missing_nutrient_rows:
        recommendations.append({
            "type": "data",
            "priority": "medium",
            "title": "Action qualite donnees",
            "action": f"Completer l'analyse labo de {missing_nutrient_rows[0]} avant la prochaine optimisation.",
            "impact": "Priorite: proteine, energie, fibre, calcium, phosphore. Cela evite des recommandations IA trop fragiles.",
            "validation": _validation("data_check", "Controle deterministe des nutriments manquants."),
        })
    elif process_risks:
        risk = process_risks[0]
        recommendations.append({
            "type": "process",
            "priority": "medium",
            "title": "Action usine",
            "action": "Faire valider la tenue granule sur un lot pilote avant lancement complet.",
            "impact": risk["detail"],
            "validation": _validation("data_check", "Alerte process deduite des valeurs nutritionnelles atteintes."),
        })

    return recommendations


def _dedupe_recommendations(recommendations: list[dict[str, Any]], limit: int = 6) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    priority_order = {"high": 0, "medium": 1, "low": 2}
    for recommendation in sorted(recommendations, key=lambda item: priority_order.get(str(item.get("priority")), 3)):
        key = f"{recommendation.get('type')}|{recommendation.get('title')}|{recommendation.get('action')}"
        if key in seen:
            continue
        seen.add(key)
        result.append(recommendation)
        if len(result) >= limit:
            break
    return result


def generate_business_review(ingredients: list[Any], recipes: list[Any], result: dict[str, Any]) -> dict[str, Any]:
    usage_by_name = _total_usage_by_name(result)
    cost_shares = _cost_share_by_name(ingredients, usage_by_name)
    ingredient_names = {str(_get(ing, "name", "")) for ing in ingredients}
    result_recipes = result.get("recipes", []) or []

    alerts: list[dict[str, Any]] = []
    missing_constraints = []
    tight_constraints = []
    process_risks = []

    for ing in ingredients:
        name = str(_get(ing, "name", ""))
        stock = float(_get(ing, "inventory_limit_tons", 0.0) or 0.0)
        used = usage_by_name.get(name, 0.0)
        ratio = _safe_div(used, stock)
        if stock > 0 and ratio >= 0.9:
            severity = "critical" if ratio >= 0.98 else "warning"
            alerts.append({
                "severity": severity,
                "title": f"Stock sous tension: {name}",
                "detail": f"{used:.2f} t utilisees sur {stock:.2f} t disponibles ({ratio * 100:.1f}%).",
                "evidence": "Une hausse de demande ou une perte process peut rendre le plan infaisable.",
            })

    for recipe in recipes:
        result_recipe = _result_recipe_for(recipe, result)
        missing = _critical_missing(recipe)
        if missing:
            missing_constraints.extend(missing)
            alerts.append({
                "severity": "warning",
                "title": f"Cibles incompletes: {_get(recipe, 'name', '')}",
                "detail": f"Contraintes absentes: {', '.join(missing[:4])}.",
                "evidence": "Le plan est faisable mathematiquement, mais le risque nutritionnel n'est pas totalement borne.",
            })
        if result_recipe:
            tight = _constraint_tightness(recipe, result_recipe, ingredient_names)
            tight_constraints.extend(tight)
            if tight:
                first = tight[0]
                alerts.append({
                    "severity": "info" if first["mode"] != "exact" else "warning",
                    "title": f"Contrainte sensible: {first['key']}",
                    "detail": f"{_get(recipe, 'name', '')}: atteint {first['achieved']:.2f} pour cible {first['target']:.2f}.",
                    "evidence": "Petite variation de prix, stock ou analyse labo peut modifier fortement la solution.",
                })

    for result_recipe in result_recipes:
        process_risks.extend(_process_risks(result_recipe))
    for risk in process_risks[:3]:
        alerts.append({
            "severity": risk["severity"],
            "title": risk["label"],
            "detail": risk["detail"],
            "evidence": "Controle process base sur les nutriments atteints par le solveur.",
        })

    missing_nutrient_rows = [
        str(_get(ing, "name", ""))
        for ing in ingredients
        if len(_get(ing, "nutrients", {}) or {}) < 3
    ]
    if missing_nutrient_rows:
        alerts.append({
            "severity": "warning",
            "title": "Qualite donnees ingredient",
            "detail": f"{len(missing_nutrient_rows)} matiere(s) ont moins de 3 nutriments renseignes.",
            "evidence": ", ".join(missing_nutrient_rows[:4]),
        })

    top_cost_share = max(cost_shares.values(), default=0.0)
    stock_penalty = sum(12 for ing in ingredients if _safe_div(usage_by_name.get(str(_get(ing, "name", "")), 0.0), float(_get(ing, "inventory_limit_tons", 0.0) or 0.0)) >= 0.98)
    stock_penalty += sum(6 for ing in ingredients if 0.9 <= _safe_div(usage_by_name.get(str(_get(ing, "name", "")), 0.0), float(_get(ing, "inventory_limit_tons", 0.0) or 0.0)) < 0.98)
    exact_penalty = sum(5 for item in tight_constraints if item["mode"] == "exact")
    scores = {
        "feasibility": _score("Robustesse faisabilite", 100 - stock_penalty - exact_penalty, "Risque stock, exact targets et marge solveur."),
        "nutrition": _score("Controle nutrition", 100 - len(missing_constraints) * 6 - len(tight_constraints) * 3, "Cibles critiques, marges min/max et contraintes exactes."),
        "purchasing": _score("Risque achats", 100 - (18 if top_cost_share > 0.5 else 8 if top_cost_share > 0.35 else 0) - stock_penalty, "Concentration cout et tension stock."),
        "process": _score("Faisabilite usine", 100 - len(process_risks) * 12, "Fibre, matiere grasse, rendement et risque granulation."),
        "data": _score("Qualite donnees", 100 - len(missing_nutrient_rows) * 5, "Nutriments, codes, couts et stocks disponibles."),
    }
    global_score = _clamp_score(sum(item["score"] for item in scores.values()) / len(scores))

    recommendations: list[dict[str, Any]] = []
    recommendations.extend(_build_shadow_price_recommendations(ingredients, recipes, result, usage_by_name))
    recommendations.extend(_build_stock_recommendations(ingredients, recipes, result, usage_by_name))
    recommendations.extend(_build_constraint_recommendations(ingredients, recipes, result, ingredient_names))
    recommendations.extend(_build_precise_next_actions(
        ingredients,
        recipes,
        result,
        usage_by_name,
        cost_shares,
        ingredient_names,
        missing_nutrient_rows,
        process_risks,
    ))
    if missing_nutrient_rows:
        recommendations.append({
            "type": "data",
            "priority": "medium",
            "title": "Completer les analyses labo",
            "action": f"Renseigner au minimum proteine, energie, fibre, calcium/phosphore sur: {', '.join(missing_nutrient_rows[:3])}.",
            "impact": "Ameliore la fiabilite des futures recommandations IA sans changer le plan actuel.",
            "validation": _validation("data_check", "Controle deterministe des champs nutriments disponibles."),
        })

    recommendations = _dedupe_recommendations(recommendations)
    if not alerts:
        alerts.append({
            "severity": "success",
            "title": "Plan stable",
            "detail": "Aucun risque critique detecte avec les stocks, contraintes et matieres actives selectionnees.",
            "evidence": "Analyse basee sur le resultat optimal GLOP.",
        })

    summary = (
        "Plan tres solide; l'IA peut se concentrer sur les opportunites d'achat."
        if global_score >= 85
        else "Plan exploitable, mais certaines marges doivent etre surveillees avant production."
        if global_score >= 70
        else "Plan faisable mais fragile; prioriser les alertes avant lancement industriel."
    )

    return {
        "is_grounded": True,
        "global_score": global_score,
        "summary": summary,
        "scores": scores,
        "alerts": alerts[:8],
        "recommendations": recommendations,
        "guardrails": [
            "Seules les matieres actives selectionnees sont utilisees.",
            "Chaque recommandation chiffre une simulation GLOP ou indique clairement qu'il s'agit d'un controle donnees.",
            "Aucune matiere premiere externe n'est proposee sans stock actif dans votre environnement.",
            "Les scenarios nutritionnels faisables restent marques comme a valider par le nutritionniste.",
        ],
    }
