def _ingredient(name="Corn", protein=12, stock=20):
    return {
        "code": "ING-TEST",
        "name": name,
        "cost": 1.0,
        "transport_cost": 0.0,
        "dm": 88,
        "nutrients": {"Protein %": protein, "Energy": 3300},
        "inventory_limit_tons": stock,
        "is_active": True,
    }


def _recipe(name="Grower"):
    return {
        "code": "FOR-TEST",
        "name": name,
        "demand_tons": 5,
        "process_yield_percent": 100,
        "bag_size_kg": 50,
        "constraints": {"Protein %": {"min": 10}, "Energy": {"min": 2500}},
        "species": "General",
    }


def test_tenant_isolation_for_ingredients(client):
    res_a = client.post("/api/ingredients", json=_ingredient("Tenant A Corn"), headers={"X-Test-Tenant": "tenant-a"})
    assert res_a.status_code == 200

    res_b = client.post("/api/ingredients", json=_ingredient("Tenant B Soy"), headers={"X-Test-Tenant": "tenant-b"})
    assert res_b.status_code == 200

    list_a = client.get("/api/ingredients", headers={"X-Test-Tenant": "tenant-a"}).json()
    list_b = client.get("/api/ingredients", headers={"X-Test-Tenant": "tenant-b"}).json()

    assert [row["name"] for row in list_a] == ["Tenant A Corn"]
    assert [row["name"] for row in list_b] == ["Tenant B Soy"]


def test_catalog_codes_can_be_created_and_updated(client):
    ing_payload = _ingredient("Coded Corn", protein=13)
    ing_payload["code"] = " corn-01 "
    ing = client.post("/api/ingredients", json=ing_payload, headers={"X-Test-Tenant": "tenant-a"}).json()
    assert ing["code"] == "CORN-01"

    updated = client.put(
        f"/api/ingredients/{ing['id']}",
        json={**ing_payload, "code": "maize-local", "cost": 1.2},
        headers={"X-Test-Tenant": "tenant-a"},
    ).json()
    assert updated["code"] == "MAIZE-LOCAL"

    recipe_payload = _recipe("Coded Grower")
    recipe_payload["code"] = " grower-01 "
    recipe = client.post("/api/recipes", json=recipe_payload, headers={"X-Test-Tenant": "tenant-a"}).json()
    assert recipe["code"] == "GROWER-01"


def test_viewer_role_cannot_mutate_but_can_read(client):
    blocked = client.post(
        "/api/ingredients",
        json=_ingredient(),
        headers={"X-Test-Tenant": "tenant-a", "X-Test-Role": "viewer"},
    )
    assert blocked.status_code == 403

    allowed = client.get("/api/ingredients", headers={"X-Test-Tenant": "tenant-a", "X-Test-Role": "viewer"})
    assert allowed.status_code == 200


def test_nutrient_keys_endpoint_returns_lightweight_catalog(client):
    client.post("/api/ingredients", json=_ingredient("Corn", protein=14), headers={"X-Test-Tenant": "tenant-a"})

    res = client.get("/api/nutrient-keys", headers={"X-Test-Tenant": "tenant-a"})

    assert res.status_code == 200
    assert res.json() == ["Energy", "Protein %"]


def test_optimize_multi_persists_history_and_audit(client):
    ing = client.post("/api/ingredients", json=_ingredient("Corn", protein=14), headers={"X-Test-Tenant": "tenant-a"}).json()
    payload = {"ingredient_ids": [ing["id"]], "recipes": [_recipe()]}

    res = client.post("/api/optimize-multi", json=payload, headers={"X-Test-Tenant": "tenant-a"})
    assert res.status_code == 200
    assert res.json()["status"] == "Optimal"

    runs = client.get("/api/optimization-runs", headers={"X-Test-Tenant": "tenant-a"}).json()
    assert len(runs) == 1
    assert runs[0]["status"] == "optimal"
    assert runs[0]["recipe_count"] == 1

    detail = client.get(f"/api/optimization-runs/{runs[0]['id']}", headers={"X-Test-Tenant": "tenant-a"}).json()
    assert detail["result_payload"]["status"] == "Optimal"
    assert detail["request_payload"]["ingredient_ids"] == [ing["id"]]

    audit = client.get("/api/audit-logs", headers={"X-Test-Tenant": "tenant-a"}).json()
    assert any(row["action"] == "optimization.run" for row in audit)


def test_ai_business_review_is_grounded_in_active_solver_context(client):
    corn = client.post("/api/ingredients", json=_ingredient("Corn", protein=14, stock=10), headers={"X-Test-Tenant": "tenant-a"}).json()
    soy_payload = _ingredient("Soy 46", protein=46, stock=10)
    soy_payload["cost"] = 2.0
    soy = client.post("/api/ingredients", json=soy_payload, headers={"X-Test-Tenant": "tenant-a"}).json()
    payload = {"ingredient_ids": [corn["id"], soy["id"]], "recipes": [_recipe("Grounded Grower")]}

    optimized = client.post("/api/optimize-multi", json=payload, headers={"X-Test-Tenant": "tenant-a"})
    assert optimized.status_code == 200

    review = client.post(
        "/api/ai-business-review",
        json={**payload, "result": optimized.json()},
        headers={"X-Test-Tenant": "tenant-a"},
    )

    assert review.status_code == 200
    body = review.json()
    assert body["is_grounded"] is True
    assert 0 <= body["global_score"] <= 100
    assert body["guardrails"]
    assert set(body["scores"].keys()) == {"feasibility", "nutrition", "purchasing", "process", "data"}
    assert len(body["recommendations"]) >= 2
    assert all("validation" in rec for rec in body["recommendations"])


def test_monitoring_counts_infeasible_optimization(client):
    ing = client.post("/api/ingredients", json=_ingredient("Weak", protein=2), headers={"X-Test-Tenant": "tenant-a"}).json()
    impossible = _recipe("Impossible")
    impossible["constraints"] = {"Protein %": {"min": 80}}

    res = client.post(
        "/api/optimize-multi",
        json={"ingredient_ids": [ing["id"]], "recipes": [impossible]},
        headers={"X-Test-Tenant": "tenant-a"},
    )
    assert res.status_code == 400

    summary = client.get("/api/monitoring/summary", headers={"X-Test-Tenant": "tenant-a"}).json()
    assert summary["total_optimization_runs"] == 1
    assert summary["infeasible_runs"] == 1
    assert summary["infeasibility_rate"] == 100


def test_parametric_analysis_targets_one_recipe_with_mode(client):
    ing = client.post("/api/ingredients", json=_ingredient("Corn", protein=14), headers={"X-Test-Tenant": "tenant-a"}).json()
    payload = {
        "ingredient_ids": [ing["id"]],
        "recipes": [_recipe("Starter"), _recipe("Finisher")],
        "nutrient_key": "Protein %",
        "target_recipe_name": "Starter",
        "constraint_mode": "exact",
        "start_value": 14,
        "end_value": 14,
        "steps": 2,
    }

    res = client.post("/api/parametric-analysis", json=payload, headers={"X-Test-Tenant": "tenant-a"})
    assert res.status_code == 200
    body = res.json()
    assert body["target_recipe_name"] == "Starter"
    assert body["constraint_mode"] == "exact"
    assert len(body["data"]) == 2
    assert all(point["cost"] is not None for point in body["data"])
