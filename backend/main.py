from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Query, File, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Dict, Literal
from sqlalchemy.orm import Session
from datetime import UTC, datetime, timedelta

from database import get_db, SessionLocal
from db_models import IngredientDB, RecipeDB, TenantDB, AuditLogDB, OptimizationRunDB, ApiEventDB
from auth import TenantContext, get_tenant_context, require_role
from solver import solve_least_cost_formulation, solve_multi_blend
from ai_service import generate_financial_insights, generate_formulator_audit, suggest_best_practice_bounds
from migration_utils import run_migrations

# Schema migrations are managed by Alembic.
import os
import time


@asynccontextmanager
async def lifespan(_app: FastAPI):
    run_migrations()
    seed_database()
    yield


app = FastAPI(
    title="Mizan Formulation API",
    lifespan=lifespan,
    description="Least-Cost Livestock Feed Optimizer — Single & Multi-Blend",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_URL", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════  PYDANTIC SCHEMAS  ═══════════════════════════════

@app.middleware("http")
async def api_event_middleware(request: Request, call_next):
    start = time.perf_counter()
    status_code = 500
    error_text = None
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    except Exception as exc:
        error_text = str(exc)
        raise
    finally:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        if request.url.path.startswith("/api") and status_code >= 400:
            tenant_id = request.headers.get("x-tenant-id") or request.headers.get("x-test-tenant")
            if not tenant_id:
                try:
                    tenant_id = get_tenant_context(
                        authorization=request.headers.get("authorization"),
                        x_tenant_id=tenant_id,
                    ).tenant_id
                except Exception:
                    tenant_id = None
            db = SessionLocal()
            try:
                db.add(ApiEventDB(
                    tenant_id=tenant_id,
                    method=request.method,
                    path=request.url.path,
                    status_code=status_code,
                    duration_ms=duration_ms,
                    error=error_text,
                ))
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()


def _record_audit(
    db: Session,
    tenant: TenantContext,
    action: str,
    entity_type: str,
    entity_id: str | int | None = None,
    metadata: dict | None = None,
) -> None:
    db.add(AuditLogDB(
        tenant_id=tenant.tenant_id,
        user_id=tenant.user_id,
        role=tenant.role,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        metadata_=metadata or {},
    ))


def _save_optimization_run(
    db: Session,
    tenant: TenantContext,
    request_payload: dict,
    status: str,
    duration_ms: float,
    result_payload: dict | None = None,
    error: str | None = None,
) -> OptimizationRunDB:
    result_payload = result_payload or {}
    run = OptimizationRunDB(
        tenant_id=tenant.tenant_id,
        user_id=tenant.user_id,
        status=status,
        total_factory_cost_tnd=result_payload.get("total_factory_cost_tnd"),
        recipe_count=len(request_payload.get("recipes", [])),
        ingredient_count=len(request_payload.get("ingredient_ids", [])),
        duration_ms=round(duration_ms, 2),
        error=error,
        request_payload=request_payload,
        result_payload=result_payload,
    )
    db.add(run)
    db.flush()
    _record_audit(
        db,
        tenant,
        "optimization.run",
        "optimization_run",
        run.id,
        {"status": status, "duration_ms": round(duration_ms, 2), "recipe_count": run.recipe_count},
    )
    return run


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

class MultiBlendIngredient(BaseModel):
    name: str
    cost: float = Field(ge=0)
    transport_cost: float = Field(default=0.0, ge=0)
    dm: float = Field(gt=0, le=100)
    nutrients: Dict[str, float] = Field(default_factory=dict)
    inventory_limit_tons: float = Field(ge=0)
    is_active: bool = True

class MultiBlendIngredientUpdate(BaseModel):
    name: Optional[str] = None
    cost: Optional[float] = Field(default=None, ge=0)
    transport_cost: Optional[float] = Field(default=None, ge=0)
    dm: Optional[float] = Field(default=None, gt=0, le=100)
    nutrients: Optional[Dict[str, float]] = None
    inventory_limit_tons: Optional[float] = Field(default=None, ge=0)
    is_active: Optional[bool] = None

class ConstraintConfig(BaseModel):
    min: Optional[float] = Field(default=None, ge=0)
    max: Optional[float] = Field(default=None, ge=0)
    exact: Optional[float] = Field(default=None, ge=0)

class RecipeDemand(BaseModel):
    name: str
    demand_tons: float = Field(gt=0)
    process_yield_percent: float = Field(default=100.0, gt=0, le=100)
    bag_size_kg: float = Field(default=50.0, gt=0)
    constraints: Dict[str, ConstraintConfig] = Field(default_factory=dict)
    parent_id: Optional[int] = None
    version_tag: str = "V1"
    species: str = "General"

class MultiBlendRequest(BaseModel):
    ingredient_ids: List[int]
    recipes: List[RecipeDemand]

# -- CRUD response schemas (include DB id) --
class IngredientOut(MultiBlendIngredient):
    id: int
    model_config = ConfigDict(from_attributes=True)

class RecipeOut(RecipeDemand):
    id: int
    parent_id: Optional[int] = None
    version_tag: str = "V1"
    model_config = ConfigDict(from_attributes=True)

class RecipeOutGrouped(RecipeOut):
    versions: List[RecipeOut] = []

class TenantBootstrapRequest(BaseModel):
    name: str = "Mizan Workspace"
    locale: str = Field(default="fr", pattern="^(fr|en|ar)$")

class TenantUpdateRequest(BaseModel):
    name: Optional[str] = None
    locale: Optional[str] = Field(default=None, pattern="^(fr|en|ar)$")
    onboarding_completed: Optional[bool] = None

class TenantOut(BaseModel):
    tenant_id: str
    role: str
    name: str
    locale: str
    onboarding_completed: bool


class AuditLogOut(BaseModel):
    id: int
    tenant_id: str
    user_id: str
    role: str
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    metadata: Dict = Field(default_factory=dict)
    created_at: str | None = None


class OptimizationRunOut(BaseModel):
    id: int
    status: str
    total_factory_cost_tnd: Optional[float] = None
    recipe_count: int
    ingredient_count: int
    duration_ms: float
    error: Optional[str] = None
    created_at: str | None = None


class MonitoringSummary(BaseModel):
    total_optimization_runs: int
    infeasible_runs: int
    infeasibility_rate: float
    average_solver_time_ms: float
    api_errors_24h: int


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
def _tenant_out(row: TenantDB, tenant_id: str, role: str = "admin") -> TenantOut:
    return TenantOut(
        tenant_id=tenant_id,
        role=role,
        name=row.name,
        locale=row.locale,
        onboarding_completed=row.onboarding_completed,
    )


def _ensure_tenant(db: Session, tenant: TenantContext, name: str | None = None, locale: str | None = None) -> TenantDB:
    row = db.query(TenantDB).filter(TenantDB.tenant_key == tenant.tenant_id).first()
    if row:
        return row

    row = TenantDB(
        tenant_key=tenant.tenant_id,
        name=name or "Mizan Workspace",
        locale=locale or "fr",
        onboarding_completed=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _clone_public_seed_data(db: Session, tenant_id: str) -> None:
    if tenant_id == "public":
        return
    if db.query(IngredientDB).filter(IngredientDB.tenant_id == tenant_id).count() > 0:
        return

    import copy

    for ing in db.query(IngredientDB).filter(IngredientDB.tenant_id == "public").all():
        db.add(IngredientDB(
            tenant_id=tenant_id,
            name=ing.name,
            cost=ing.cost,
            transport_cost=ing.transport_cost,
            dm=ing.dm,
            nutrients=copy.deepcopy(ing.nutrients or {}),
            inventory_limit_tons=ing.inventory_limit_tons,
            is_active=ing.is_active,
        ))

    parent_map: dict[int, RecipeDB] = {}
    public_masters = db.query(RecipeDB).filter(
        RecipeDB.tenant_id == "public",
        RecipeDB.parent_id == None,
    ).all()
    for rec in public_masters:
        clone = RecipeDB(
            tenant_id=tenant_id,
            name=rec.name,
            demand_tons=rec.demand_tons,
            constraints=copy.deepcopy(rec.constraints or {}),
            process_yield_percent=rec.process_yield_percent,
            bag_size_kg=rec.bag_size_kg,
            parent_id=None,
            version_tag=rec.version_tag,
            species=rec.species,
        )
        db.add(clone)
        db.flush()
        parent_map[rec.id] = clone

    public_versions = db.query(RecipeDB).filter(
        RecipeDB.tenant_id == "public",
        RecipeDB.parent_id != None,
    ).all()
    for rec in public_versions:
        parent = parent_map.get(rec.parent_id)
        if not parent:
            continue
        db.add(RecipeDB(
            tenant_id=tenant_id,
            name=rec.name,
            demand_tons=rec.demand_tons,
            constraints=copy.deepcopy(rec.constraints or {}),
            process_yield_percent=rec.process_yield_percent,
            bag_size_kg=rec.bag_size_kg,
            parent_id=parent.id,
            version_tag=rec.version_tag,
            species=rec.species,
        ))

    db.commit()


def seed_database():
    """Seed defaults if tables are empty. Alembic owns schema migrations."""
    import os as _os, json as _json
    db = next(get_db())
    try:
        # ── Seed empty tables ────────────────────────────────────────────
        if db.query(TenantDB).filter(TenantDB.tenant_key == "public").first() is None:
            db.add(TenantDB(
                tenant_key="public",
                name="Public Seed Workspace",
                locale="fr",
                onboarding_completed=True,
            ))
            db.commit()

        if db.query(IngredientDB).filter(IngredientDB.tenant_id == "public").count() == 0:
            for row in DEFAULT_INGREDIENTS:
                db.add(IngredientDB(tenant_id="public", **row))
            db.commit()

        if db.query(RecipeDB).filter(RecipeDB.tenant_id == "public").count() == 0:
            for row in DEFAULT_RECIPES:
                db.add(RecipeDB(tenant_id="public", **row))
            db.commit()

        # ── Auto-restore missing nutrients from INRAE JSON ─────────────────
        # If the JSON is on disk and some ingredients have < 5 nutrients,
        # patch them silently to recover from the lite=true save bug.
        try:
            json_path = _os.path.join(_os.path.dirname(__file__), "inrae_scraped_data_full.json")
            if _os.path.exists(json_path):
                with open(json_path, "r", encoding="utf-8") as f:
                    inrae_list = _json.load(f)
                inrae_dict = {item["name"]: item.get("nutrients", {}) for item in inrae_list}
                patched = 0
                for ing in db.query(IngredientDB).all():
                    if ing.name in inrae_dict and (not ing.nutrients or len(ing.nutrients) < 5):
                        ing.nutrients = inrae_dict[ing.name]
                        patched += 1
                if patched > 0:
                    db.commit()
                    print(f"⚙️  Auto-restored nutrients for {patched} ingredient(s) from INRAE JSON")
        except Exception as e:
            print(f"Auto-restore warning: {e}")

    finally:
        db.close()


# ═══════════════════  CRUD — INGREDIENTS  ═════════════════════════════

# Tenant bootstrap

@app.get("/api/tenant/me", response_model=TenantOut)
def get_tenant_me(
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    row = _ensure_tenant(db, tenant)
    return _tenant_out(row, tenant.tenant_id, tenant.role)


@app.post("/api/tenant/bootstrap", response_model=TenantOut)
def bootstrap_tenant(
    request: TenantBootstrapRequest,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    row = _ensure_tenant(db, tenant, request.name, request.locale)
    row.name = request.name
    row.locale = request.locale
    _clone_public_seed_data(db, tenant.tenant_id)
    _record_audit(db, tenant, "tenant.bootstrap", "tenant", tenant.tenant_id, {"name": request.name, "locale": request.locale})
    db.commit()
    db.refresh(row)
    return _tenant_out(row, tenant.tenant_id, tenant.role)


@app.patch("/api/tenant/me", response_model=TenantOut)
def update_tenant_me(
    request: TenantUpdateRequest,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_role("admin")),
):
    row = _ensure_tenant(db, tenant)
    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(row, key, value)
    _record_audit(db, tenant, "tenant.update", "tenant", tenant.tenant_id, update_data)
    db.commit()
    db.refresh(row)
    return _tenant_out(row, tenant.tenant_id, tenant.role)


@app.get("/api/ingredients", response_model=List[IngredientOut])
def list_ingredients(
    lite: bool = False,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    _ensure_tenant(db, tenant)
    rows = db.query(IngredientDB).filter(IngredientDB.tenant_id == tenant.tenant_id).all()
    if lite:
        result = []
        for row in rows:
            data = {
                "id": row.id,
                "name": row.name,
                "cost": row.cost,
                "transport_cost": row.transport_cost,
                "dm": row.dm,
                "inventory_limit_tons": row.inventory_limit_tons,
                "is_active": row.is_active,
                "nutrients": {}
            }
            # Preserve essential macros for UI main table
            if row.nutrients:
                for tk in ["Crude protein (%)", "Crude protein", "Protéine %"]:
                    if tk in row.nutrients:
                        data["nutrients"][tk] = row.nutrients[tk]
                        break
            result.append(data)
        return result
    return rows

@app.get("/api/ingredients/{ingredient_id}", response_model=IngredientOut)
def get_ingredient(
    ingredient_id: int,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    row = db.query(IngredientDB).filter(
        IngredientDB.id == ingredient_id,
        IngredientDB.tenant_id == tenant.tenant_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return row


@app.post("/api/ingredients", response_model=IngredientOut)
def create_ingredient(
    data: MultiBlendIngredient,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_role("formulator")),
):
    _ensure_tenant(db, tenant)
    row = IngredientDB(tenant_id=tenant.tenant_id, **data.model_dump())
    db.add(row)
    db.flush()
    _record_audit(db, tenant, "ingredient.create", "ingredient", row.id, {"name": row.name})
    db.commit()
    db.refresh(row)
    return row


@app.put("/api/ingredients/{ingredient_id}", response_model=IngredientOut)
def update_ingredient(
    ingredient_id: int,
    data: MultiBlendIngredientUpdate,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_role("formulator")),
):
    row = db.query(IngredientDB).filter(
        IngredientDB.id == ingredient_id,
        IngredientDB.tenant_id == tenant.tenant_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(row, key, value)
    _record_audit(db, tenant, "ingredient.update", "ingredient", ingredient_id, update_data)
    db.commit()
    db.refresh(row)
    return row


@app.delete("/api/ingredients/{ingredient_id}")
def delete_ingredient(
    ingredient_id: int,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_role("formulator")),
):
    row = db.query(IngredientDB).filter(
        IngredientDB.id == ingredient_id,
        IngredientDB.tenant_id == tenant.tenant_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    _record_audit(db, tenant, "ingredient.delete", "ingredient", ingredient_id, {"name": row.name})
    db.delete(row)
    db.commit()
    return {"ok": True}

@app.post("/api/admin/restore-nutrients")
def restore_nutrients(
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_role("admin")),
):
    """
    Safely restores missing nutrient profiles from the INRAE JSON file
    without overwriting user-modified costs or inventory limits.
    """
    import os
    import json
    
    json_path = os.path.join(os.path.dirname(__file__), "inrae_scraped_data_full.json")
    if not os.path.exists(json_path):
        raise HTTPException(status_code=404, detail="INRAE data file not found on server")
        
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # Create a lookup dictionary by name
        inrae_dict = {item["name"]: item.get("nutrients", {}) for item in data}
        
        updated_count = 0
        all_ingredients = db.query(IngredientDB).filter(IngredientDB.tenant_id == tenant.tenant_id).all()
        for ing in all_ingredients:
            if ing.name in inrae_dict:
                # Only update if the DB nutrients are empty or very small (meaning they were wiped by the lite=true bug)
                if not ing.nutrients or len(ing.nutrients) < 5:
                    ing.nutrients = inrae_dict[ing.name]
                    updated_count += 1
                    
        db.commit()
        return {"ok": True, "restored_count": updated_count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════  CRUD — RECIPES  ═════════════════════════════════

from sqlalchemy.sql import text

@app.get("/api/recipes", response_model=List[RecipeOutGrouped])
def list_recipes(
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    _ensure_tenant(db, tenant)
    all_recipes = db.query(RecipeDB).filter(RecipeDB.tenant_id == tenant.tenant_id).all()
    
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
            "species": m.species or "General",
            "versions": []
        }
        if m.id in versions_map:
            m_dict["versions"] = versions_map[m.id]
        result.append(m_dict)
        
    return result


@app.get("/api/standards")
def list_standards():
    """Returns the internal catalog of genetic nutrition standards."""
    import os
    import json
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "standards.json")
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


@app.post("/api/recipes", response_model=RecipeOut)
def create_recipe(
    data: RecipeDemand,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_role("formulator")),
):
    _ensure_tenant(db, tenant)
    row = RecipeDB(tenant_id=tenant.tenant_id, **data.model_dump())
    db.add(row)
    db.flush()
    _record_audit(db, tenant, "recipe.create", "recipe", row.id, {"name": row.name})
    db.commit()
    db.refresh(row)
    return row

class SuggestBoundsRequest(BaseModel):
    recipe_name: str
    elements: List[str]
    species: str = "Standard"

@app.post("/api/recipes/suggest-bounds")
async def api_suggest_bounds(
    request: SuggestBoundsRequest,
    tenant: TenantContext = Depends(require_role("formulator")),
):
    try:
        suggestions = await suggest_best_practice_bounds(request.recipe_name, request.elements, request.species)
        return {"status": "ok", "suggestions": suggestions}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur interne du serveur lors de l'appel à l'IA.")

@app.post("/api/recipes/extract-bounds")
async def api_extract_bounds(
    file: UploadFile = File(...),
    species: str = "Standard",
    tenant: TenantContext = Depends(require_role("formulator")),
):
    try:
        from ai_service import extract_bounds_from_image
        contents = await file.read()
        if len(contents) > 8 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 8 MB.")
        if file.content_type not in {"image/png", "image/jpeg", "image/webp", "application/pdf"}:
            raise HTTPException(status_code=400, detail="Unsupported file type.")
        suggestions = await extract_bounds_from_image(contents, file.content_type, species)
        return {"status": "ok", "suggestions": suggestions}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in extract-bounds API: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class RevisionRequest(BaseModel):
    version_tag: str

@app.post("/api/recipes/{recipe_id}/revision", response_model=RecipeOut)
def create_recipe_revision(
    recipe_id: int,
    request: RevisionRequest,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_role("formulator")),
):
    parent = db.query(RecipeDB).filter(
        RecipeDB.id == recipe_id,
        RecipeDB.tenant_id == tenant.tenant_id,
    ).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent recipe not found")
        
    # The parent_id for the new revision is either the referenced recipe's ID (if it's a master)
    # or the referenced recipe's parent_id (if we are duplicating an existing revision).
    actual_parent_id = parent.parent_id if parent.parent_id is not None else parent.id
    
    import copy
    new_row = RecipeDB(
        tenant_id=tenant.tenant_id,
        name=parent.name,
        demand_tons=parent.demand_tons,
        process_yield_percent=parent.process_yield_percent,
        bag_size_kg=parent.bag_size_kg,
        constraints=copy.deepcopy(parent.constraints),
        parent_id=actual_parent_id,
        version_tag=request.version_tag
    )
    db.add(new_row)
    db.flush()
    _record_audit(db, tenant, "recipe.revision", "recipe", new_row.id, {"source_id": recipe_id, "version_tag": request.version_tag})
    db.commit()
    db.refresh(new_row)
    return new_row


@app.put("/api/recipes/{recipe_id}", response_model=RecipeOut)
def update_recipe(
    recipe_id: int,
    data: RecipeDemand,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_role("formulator")),
):
    row = db.query(RecipeDB).filter(
        RecipeDB.id == recipe_id,
        RecipeDB.tenant_id == tenant.tenant_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Recipe not found")
        
    update_data = data.model_dump()
    for key, value in update_data.items():
        setattr(row, key, value)
    _record_audit(db, tenant, "recipe.update", "recipe", recipe_id, {"name": row.name})
    db.commit()
    db.refresh(row)
    return row


@app.delete("/api/recipes/{recipe_id}")
def delete_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_role("formulator")),
):
    db_item = db.query(RecipeDB).filter(
        RecipeDB.id == recipe_id,
        RecipeDB.tenant_id == tenant.tenant_id,
    ).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # Check if it has child revisions
    children = db.query(RecipeDB).filter(
        RecipeDB.parent_id == recipe_id,
        RecipeDB.tenant_id == tenant.tenant_id,
    ).all()
    for child in children:
        db.delete(child)

    _record_audit(db, tenant, "recipe.delete", "recipe", recipe_id, {"name": db_item.name, "children": len(children)})
    db.delete(db_item)
    db.commit()
    return {"status": "ok", "deleted_id": recipe_id}


# ═══════════════════  OPTIMIZATION ENDPOINTS  ═════════════════════════

@app.post("/api/optimize")
def optimize_recipe(
    request: OptimizeRequest,
    tenant: TenantContext = Depends(require_role("formulator", "purchasing")),
):
    try:
        return solve_least_cost_formulation(request.ingredients, request.constraints)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/optimize-multi")
def optimize_multi_blend(
    request: MultiBlendRequest,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_role("formulator", "purchasing")),
):
    started = time.perf_counter()
    request_payload = request.model_dump()
    try:
        ingredients_to_use = db.query(IngredientDB).filter(
            IngredientDB.tenant_id == tenant.tenant_id,
            IngredientDB.is_active == True,
            IngredientDB.id.in_(request.ingredient_ids),
        ).all()
        
        # Convert DB rows to MultiBlendIngredient schema for the solver
        ing_list = []
        for row in ingredients_to_use:
            ing_list.append(MultiBlendIngredient(
                name=row.name,
                cost=row.cost,
                transport_cost=row.transport_cost,
                dm=row.dm,
                nutrients=row.nutrients or {},
                inventory_limit_tons=row.inventory_limit_tons,
                is_active=row.is_active
            ))
            
        result = solve_multi_blend(ing_list, request.recipes)
        duration_ms = (time.perf_counter() - started) * 1000
        _save_optimization_run(db, tenant, request_payload, "optimal", duration_ms, result_payload=result)
        db.commit()
        return result
    except Exception as e:
        duration_ms = (time.perf_counter() - started) * 1000
        db.rollback()
        _save_optimization_run(db, tenant, request_payload, "infeasible", duration_ms, error=str(e))
        db.commit()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/ai-insights")
async def get_ai_insights(
    recipe_result_json: dict,
    tenant: TenantContext = Depends(require_role("purchasing")),
):
    try:
        insight_markdown = await generate_financial_insights(recipe_result_json)
        return {"markdown": insight_markdown}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai-audit")
async def get_ai_audit(
    recipe_result_json: dict,
    tenant: TenantContext = Depends(require_role("formulator", "purchasing")),
):
    try:
        audit_markdown = await generate_formulator_audit(recipe_result_json)
        return {"markdown": audit_markdown}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class DiagnoseRequest(BaseModel):
    recipe_name: str
    constraints: dict
    available_ingredients: List[str]

@app.post("/api/recipes/diagnose-infeasible")
async def api_diagnose_recipe(
    request: DiagnoseRequest,
    tenant: TenantContext = Depends(require_role("formulator")),
):
    try:
        from ai_service import diagnose_infeasible_recipe
        markdown = await diagnose_infeasible_recipe(
            request.recipe_name, 
            request.constraints, 
            request.available_ingredients
        )
        return {"status": "ok", "markdown": markdown}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ParametricRequest(BaseModel):
    nutrient_key: str
    start_value: float
    end_value: float
    steps: int = Field(default=10, ge=2, le=50)
    ingredient_ids: List[int] = Field(default_factory=list)
    recipes: List[RecipeDemand] = Field(default_factory=list)
    target_recipe_name: Optional[str] = None
    constraint_mode: Literal["min", "max", "exact"] = "min"

@app.post("/api/parametric-analysis")
def run_parametric_analysis(
    request: ParametricRequest,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_role("formulator", "purchasing")),
):
    """Run the GLOP solver multiple times over a nutrient range to generate a cost curve."""
    import copy

    ingredient_query = db.query(IngredientDB).filter(
        IngredientDB.tenant_id == tenant.tenant_id,
        IngredientDB.is_active == True,
    )
    if request.ingredient_ids:
        ingredient_query = ingredient_query.filter(IngredientDB.id.in_(request.ingredient_ids))
    db_ingredients = ingredient_query.all()

    source_recipes = request.recipes
    if not source_recipes:
        db_recipes = db.query(RecipeDB).filter(
            RecipeDB.tenant_id == tenant.tenant_id,
            RecipeDB.parent_id == None,
        ).all()
        source_recipes = [
            RecipeDemand(
                name=row.name,
                demand_tons=row.demand_tons,
                process_yield_percent=row.process_yield_percent or 100.0,
                bag_size_kg=row.bag_size_kg or 50.0,
                constraints=row.constraints or {},
                species=row.species or "General",
            )
            for row in db_recipes
        ]

    if not db_ingredients or not source_recipes:
        raise HTTPException(status_code=400, detail="No ingredients or recipes in the database.")
    if request.target_recipe_name and not any(recipe.name == request.target_recipe_name for recipe in source_recipes):
        raise HTTPException(status_code=400, detail="Target recipe is not included in the optimization payload.")

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

        # Deep-copy recipes and override the target nutrient constraint.
        # If target_recipe_name is provided, only that formula is varied;
        # otherwise the curve keeps the legacy behavior and varies all formulas.
        modified_recipes = []
        for recipe in source_recipes:
            constraints = copy.deepcopy(recipe.model_dump().get("constraints", {}))
            should_vary = not request.target_recipe_name or recipe.name == request.target_recipe_name

            if should_vary:
                constraint = constraints.get(request.nutrient_key, {})
                if request.constraint_mode == "exact":
                    constraint.pop("min", None)
                    constraint.pop("max", None)
                    constraint["exact"] = current_val
                else:
                    constraint.pop("exact", None)
                    constraint[request.constraint_mode] = current_val
                constraints[request.nutrient_key] = constraint

            modified_recipes.append(RecipeDemand(
                name=recipe.name,
                demand_tons=recipe.demand_tons,
                process_yield_percent=recipe.process_yield_percent or 100.0,
                bag_size_kg=recipe.bag_size_kg or 50.0,
                constraints=constraints,
                species=recipe.species or "General",
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

    return {
        "nutrient_key": request.nutrient_key,
        "target_recipe_name": request.target_recipe_name,
        "constraint_mode": request.constraint_mode,
        "data": results,
    }


# ═══════════════════  DASHBOARD STATS  ════════════════════════════════

@app.get("/api/optimization-runs", response_model=List[OptimizationRunOut])
def list_optimization_runs(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    rows = db.query(OptimizationRunDB).filter(
        OptimizationRunDB.tenant_id == tenant.tenant_id,
    ).order_by(OptimizationRunDB.created_at.desc()).limit(limit).all()
    return [
        OptimizationRunOut(
            id=row.id,
            status=row.status,
            total_factory_cost_tnd=row.total_factory_cost_tnd,
            recipe_count=row.recipe_count,
            ingredient_count=row.ingredient_count,
            duration_ms=row.duration_ms,
            error=row.error,
            created_at=row.created_at.isoformat() if row.created_at else None,
        )
        for row in rows
    ]


@app.get("/api/optimization-runs/{run_id}")
def get_optimization_run(
    run_id: int,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    row = db.query(OptimizationRunDB).filter(
        OptimizationRunDB.id == run_id,
        OptimizationRunDB.tenant_id == tenant.tenant_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Optimization run not found")
    return {
        "id": row.id,
        "status": row.status,
        "total_factory_cost_tnd": row.total_factory_cost_tnd,
        "recipe_count": row.recipe_count,
        "ingredient_count": row.ingredient_count,
        "duration_ms": row.duration_ms,
        "error": row.error,
        "request_payload": row.request_payload,
        "result_payload": row.result_payload,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@app.get("/api/audit-logs", response_model=List[AuditLogOut])
def list_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_role("admin")),
):
    rows = db.query(AuditLogDB).filter(
        AuditLogDB.tenant_id == tenant.tenant_id,
    ).order_by(AuditLogDB.created_at.desc()).limit(limit).all()
    return [
        AuditLogOut(
            id=row.id,
            tenant_id=row.tenant_id,
            user_id=row.user_id,
            role=row.role,
            action=row.action,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            metadata=row.metadata_ or {},
            created_at=row.created_at.isoformat() if row.created_at else None,
        )
        for row in rows
    ]


@app.get("/api/monitoring/summary", response_model=MonitoringSummary)
def get_monitoring_summary(
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_role("admin")),
):
    runs = db.query(OptimizationRunDB).filter(OptimizationRunDB.tenant_id == tenant.tenant_id).all()
    total_runs = len(runs)
    infeasible_runs = len([run for run in runs if run.status != "optimal"])
    avg_duration = sum(run.duration_ms for run in runs) / total_runs if total_runs else 0.0
    error_cutoff = datetime.now(UTC) - timedelta(hours=24)
    api_errors = db.query(ApiEventDB).filter(
        ApiEventDB.tenant_id == tenant.tenant_id,
        ApiEventDB.status_code >= 500,
        ApiEventDB.created_at >= error_cutoff,
    ).count()
    return MonitoringSummary(
        total_optimization_runs=total_runs,
        infeasible_runs=infeasible_runs,
        infeasibility_rate=round((infeasible_runs / total_runs) * 100, 2) if total_runs else 0.0,
        average_solver_time_ms=round(avg_duration, 2),
        api_errors_24h=api_errors,
    )


@app.get("/api/dashboard/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    """Return high-level factory KPIs for the home dashboard."""
    _ensure_tenant(db, tenant)
    total_ingredients = db.query(IngredientDB).filter(IngredientDB.tenant_id == tenant.tenant_id).count()
    total_recipes = db.query(RecipeDB).filter(
        RecipeDB.tenant_id == tenant.tenant_id,
        RecipeDB.parent_id == None,
    ).count()
    return {
        "total_ingredients": total_ingredients,
        "total_recipes": total_recipes,
    }


if __name__ == "__main__":

    import uvicorn
    # Render.com dynamically assigns a port via the PORT environment variable
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
