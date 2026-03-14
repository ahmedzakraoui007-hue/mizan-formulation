from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from sqlalchemy.orm import Session

from database import engine, get_db, Base
from db_models import IngredientDB, RecipeDB
from solver import solve_least_cost_formulation, solve_multi_blend
from solver import solve_least_cost_formulation, solve_multi_blend
from ai_service import generate_financial_insights, generate_formulator_audit, suggest_best_practice_bounds

# ─── Create tables on startup ────────────────────────────────────────
Base.metadata.create_all(bind=engine)

import os

app = FastAPI(
    title="Mizan Formulation API",
    description="Least-Cost Livestock Feed Optimizer — Single & Multi-Blend",
)

# Determine allowed origins for CORS
allowed_origins = ["http://localhost:3000"]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════  PYDANTIC SCHEMAS  ═══════════════════════════════

# -- Single-blend (backward compat) --
class Ingredient(BaseModel):
    name: str
    cost: float
    dm: float
    protein: float
    fiber: float
    energy: float

class Constraints(BaseModel):
    min_protein: float
    max_protein: float
    min_fiber: float
    max_fiber: float
    min_energy: float

class OptimizeRequest(BaseModel):
    ingredients: List[Ingredient]
    constraints: Constraints

# -- Multi-blend --
class MultiBlendIngredient(BaseModel):
    name: str
    cost: float
    transport_cost: float = 0.0
    dm: float
    nutrients: Dict[str, float] = Field(default_factory=dict)
    inventory_limit_tons: float

class ConstraintConfig(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None
    exact: Optional[float] = None

class RecipeDemand(BaseModel):
    name: str
    demand_tons: float
    process_yield_percent: float = 100.0
    bag_size_kg: float = 50.0
    constraints: Dict[str, ConstraintConfig] = Field(default_factory=dict)
    parent_id: Optional[int] = None
    version_tag: str = "V1"
    species: str = "General"
    process_yield_percent: float = 100.0
    bag_size_kg: float = 50.0
    constraints: Dict[str, ConstraintConfig] = Field(default_factory=dict)

class MultiBlendRequest(BaseModel):
    ingredients: List[MultiBlendIngredient]
    recipes: List[RecipeDemand]

# -- CRUD response schemas (include DB id) --
class IngredientOut(MultiBlendIngredient):
    id: int
    class Config:
        from_attributes = True

class RecipeOut(RecipeDemand):
    id: int
    class Config:
        from_attributes = True

class RecipeOutGrouped(RecipeOut):
    versions: List[RecipeOut] = []


# ═══════════════════  SEED DATA  ══════════════════════════════════════

DEFAULT_INGREDIENTS = [
    {"name": "Maïs (Imported Corn)",              "cost": 1.05, "transport_cost": 0.0, "dm": 88, "inventory_limit_tons": 50, "nutrients": {"Protéine %": 8.5,  "Fibre %": 2.2,  "Énergie": 3300}},
    {"name": "Tourteau de Soja (Imported Soy 46%)", "cost": 1.95, "transport_cost": 0.0, "dm": 89, "inventory_limit_tons": 20, "nutrients": {"Protéine %": 46.0, "Fibre %": 6.0,  "Énergie": 2240}},
    {"name": "Son de Blé / Sédari (Local Bran)",  "cost": 0.45, "transport_cost": 0.0, "dm": 88, "inventory_limit_tons": 30, "nutrients": {"Protéine %": 15.0, "Fibre %": 11.0, "Énergie": 1300}},
    {"name": "Orge Locale (Local Barley)",         "cost": 0.90, "transport_cost": 0.0, "dm": 89, "inventory_limit_tons": 40, "nutrients": {"Protéine %": 11.0, "Fibre %": 5.0,  "Énergie": 2900}},
    {"name": "Tourteau d'Olive (Olive Cake)",      "cost": 0.15, "transport_cost": 0.0, "dm": 85, "inventory_limit_tons": 10, "nutrients": {"Protéine %": 7.0,  "Fibre %": 38.0, "Énergie": 1100}},
]

DEFAULT_RECIPES = [
    {"name": "Poultry Grower", "demand_tons": 25, "process_yield_percent": 100.0, "bag_size_kg": 50.0, "constraints": {"Protéine %": {"min": 17, "max": 22}, "Fibre %": {"min": 3, "max": 7},  "Énergie": {"min": 2600}}},
    {"name": "Dairy Cow",      "demand_tons": 30, "process_yield_percent": 100.0, "bag_size_kg": 50.0, "constraints": {"Protéine %": {"min": 14, "max": 18}, "Fibre %": {"min": 5, "max": 10}, "Énergie": {"min": 2200}}},
]


@app.on_event("startup")
def seed_database():
    """Seed defaults if tables are empty, and run safe migrations."""
    db = next(get_db())
    try:
        # --- Migration: Add parent_id and version_tag to recipes if missing ---
        conn = engine.connect()
        try:
            columns_query = conn.execute(text("PRAGMA table_info(recipes)")).fetchall()
            existing_cols = [col[1] for col in columns_query]
            
            if "parent_id" not in existing_cols:
                conn.execute(text("ALTER TABLE recipes ADD COLUMN parent_id INTEGER"))
            if "version_tag" not in existing_cols:
                conn.execute(text("ALTER TABLE recipes ADD COLUMN version_tag VARCHAR NOT NULL DEFAULT 'V1'"))
            if "species" not in existing_cols:
                conn.execute(text("ALTER TABLE recipes ADD COLUMN species VARCHAR NOT NULL DEFAULT 'General'"))
            conn.commit()
        except Exception as e:
            print(f"Migration error: {e}")
        finally:
            conn.close()
        # ----------------------------------------------------------------------

        if db.query(IngredientDB).count() == 0:
            for row in DEFAULT_INGREDIENTS:
                db.add(IngredientDB(**row))
            db.commit()

        if db.query(RecipeDB).count() == 0:
            for row in DEFAULT_RECIPES:
                db.add(RecipeDB(**row))
            db.commit()
    finally:
        db.close()


# ═══════════════════  CRUD — INGREDIENTS  ═════════════════════════════

@app.get("/api/ingredients", response_model=List[IngredientOut])
def list_ingredients(db: Session = Depends(get_db)):
    return db.query(IngredientDB).all()


@app.post("/api/ingredients", response_model=IngredientOut)
def create_ingredient(data: MultiBlendIngredient, db: Session = Depends(get_db)):
    row = IngredientDB(**data.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.put("/api/ingredients/{ingredient_id}", response_model=IngredientOut)
def update_ingredient(ingredient_id: int, data: MultiBlendIngredient, db: Session = Depends(get_db)):
    row = db.query(IngredientDB).filter(IngredientDB.id == ingredient_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    
    update_data = data.model_dump()
    for key, value in update_data.items():
        setattr(row, key, value)
        
    db.commit()
    db.refresh(row)
    return row


@app.delete("/api/ingredients/{ingredient_id}")
def delete_ingredient(ingredient_id: int, db: Session = Depends(get_db)):
    row = db.query(IngredientDB).filter(IngredientDB.id == ingredient_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


# ═══════════════════  CRUD — RECIPES  ═════════════════════════════════

from sqlalchemy.sql import text

@app.get("/api/recipes", response_model=List[RecipeOutGrouped])
def list_recipes(db: Session = Depends(get_db)):
    all_recipes = db.query(RecipeDB).all()
    
    # Group by parent_id
    masters = []
    versions_map = {} # parent_id -> list of recipes
    
    for r in all_recipes:
        if r.parent_id is None:
            masters.append(r)
        else:
            if r.parent_id not in versions_map:
                versions_map[r.parent_id] = []
            versions_map[r.parent_id].append(r)
            
    # Build response
    result = []
    for m in masters:
        m_dict = {
            "id": m.id, "name": m.name, "demand_tons": m.demand_tons,
            "process_yield_percent": m.process_yield_percent, "bag_size_kg": m.bag_size_kg,
            "constraints": m.constraints, "parent_id": m.parent_id, "version_tag": m.version_tag,
            "versions": []
        }
        if m.id in versions_map:
            m_dict["versions"] = versions_map[m.id]
        result.append(m_dict)
        
    return result


@app.post("/api/recipes", response_model=RecipeOut)
def create_recipe(data: RecipeDemand, db: Session = Depends(get_db)):
    row = RecipeDB(**data.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

class SuggestBoundsRequest(BaseModel):
    recipe_name: str
    elements: List[str]

@app.post("/api/recipes/suggest-bounds")
async def api_suggest_bounds(request: SuggestBoundsRequest):
    try:
        suggestions = await suggest_best_practice_bounds(request.recipe_name, request.elements)
        return {"status": "ok", "suggestions": suggestions}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur interne du serveur lors de l'appel à l'IA.")

class RevisionRequest(BaseModel):
    version_tag: str

@app.post("/api/recipes/{recipe_id}/revision", response_model=RecipeOut)
def create_recipe_revision(recipe_id: int, request: RevisionRequest, db: Session = Depends(get_db)):
    parent = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent recipe not found")
        
    # The parent_id for the new revision is either the referenced recipe's ID (if it's a master)
    # or the referenced recipe's parent_id (if we are duplicating an existing revision).
    actual_parent_id = parent.parent_id if parent.parent_id is not None else parent.id
    
    import copy
    new_row = RecipeDB(
        name=parent.name,
        demand_tons=parent.demand_tons,
        process_yield_percent=parent.process_yield_percent,
        bag_size_kg=parent.bag_size_kg,
        constraints=copy.deepcopy(parent.constraints),
        parent_id=actual_parent_id,
        version_tag=request.version_tag
    )
    db.add(new_row)
    db.commit()
    db.refresh(new_row)
    return new_row


@app.put("/api/recipes/{recipe_id}", response_model=RecipeOut)
def update_recipe(recipe_id: int, data: RecipeDemand, db: Session = Depends(get_db)):
    row = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Recipe not found")
        
    update_data = data.model_dump()
    for key, value in update_data.items():
        setattr(row, key, value)
        
    db.commit()
    db.refresh(row)
    return row


@app.delete("/api/recipes/{recipe_id}")
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    db_item = db.query(RecipeDB).filter(RecipeDB.id == recipe_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # Check if it has child revisions
    children = db.query(RecipeDB).filter(RecipeDB.parent_id == recipe_id).all()
    for child in children:
        db.delete(child)

    db.delete(db_item)
    db.commit()
    return {"status": "ok", "deleted_id": recipe_id}


# ═══════════════════  OPTIMIZATION ENDPOINTS  ═════════════════════════

@app.post("/api/optimize")
def optimize_recipe(request: OptimizeRequest):
    try:
        return solve_least_cost_formulation(request.ingredients, request.constraints)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/optimize-multi")
def optimize_multi_blend(request: MultiBlendRequest):
    try:
        return solve_multi_blend(request.ingredients, request.recipes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/ai-insights")
async def get_ai_insights(recipe_result_json: dict):
    try:
        insight_markdown = await generate_financial_insights(recipe_result_json)
        return {"markdown": insight_markdown}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai-audit")
async def get_ai_audit(recipe_result_json: dict):
    try:
        audit_markdown = await generate_formulator_audit(recipe_result_json)
        return {"markdown": audit_markdown}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ParametricRequest(BaseModel):
    nutrient_key: str
    start_value: float
    end_value: float
    steps: int = 10

@app.post("/api/parametric-analysis")
def run_parametric_analysis(request: ParametricRequest, db: Session = Depends(get_db)):
    """Run the GLOP solver multiple times over a nutrient range to generate a cost curve."""
    import copy

    # Load all ingredients and recipes from DB
    db_ingredients = db.query(IngredientDB).all()
    db_recipes = db.query(RecipeDB).all()

    if not db_ingredients or not db_recipes:
        raise HTTPException(status_code=400, detail="No ingredients or recipes in the database.")

    # Build ingredient list as simple objects the solver accepts
    ing_list = []
    for row in db_ingredients:
        ing_list.append(MultiBlendIngredient(
            name=row.name,
            cost=row.cost,
            transport_cost=row.transport_cost or 0.0,
            dm=row.dm,
            nutrients=row.nutrients or {},
            inventory_limit_tons=row.inventory_limit_tons,
        ))

    results = []
    steps = max(request.steps, 2)

    for step_idx in range(steps):
        current_val = request.start_value + (step_idx * (request.end_value - request.start_value) / (steps - 1))
        current_val = round(current_val, 4)

        # Deep-copy recipes and override the target nutrient constraint
        modified_recipes = []
        for row in db_recipes:
            constraints = copy.deepcopy(row.constraints) if row.constraints else {}
            # Override: set min = current_val for the target nutrient
            if request.nutrient_key in constraints:
                constraints[request.nutrient_key]["min"] = current_val
            else:
                constraints[request.nutrient_key] = {"min": current_val}

            modified_recipes.append(RecipeDemand(
                name=row.name,
                demand_tons=row.demand_tons,
                process_yield_percent=row.process_yield_percent or 100.0,
                bag_size_kg=row.bag_size_kg or 50.0,
                constraints=constraints,
            ))

        try:
            solver_result = solve_multi_blend(ing_list, modified_recipes)
            if solver_result.get("status") == "Optimal":
                results.append({
                    "nutrient_value": current_val,
                    "cost": round(solver_result["total_factory_cost_tnd"], 2),
                })
            else:
                results.append({"nutrient_value": current_val, "cost": None})
        except Exception:
            results.append({"nutrient_value": current_val, "cost": None})

    return {"nutrient_key": request.nutrient_key, "data": results}


# ═══════════════════  DASHBOARD STATS  ════════════════════════════════

@app.get("/api/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Return high-level factory KPIs for the home dashboard."""
    total_ingredients = db.query(IngredientDB).count()
    total_recipes = db.query(RecipeDB).filter(RecipeDB.parent_id == None).count()
    return {
        "total_ingredients": total_ingredients,
        "total_recipes": total_recipes,
    }


if __name__ == "__main__":

    import uvicorn
    # Render.com dynamically assigns a port via the PORT environment variable
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
