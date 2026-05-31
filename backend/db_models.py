from sqlalchemy import Column, Integer, String, Float, JSON, Boolean, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class TenantDB(Base):
    __tablename__ = "tenants"

    id                   = Column(Integer, primary_key=True, index=True)
    tenant_key           = Column(String,  nullable=False, unique=True, index=True)
    name                 = Column(String,  nullable=False, default="Mizan Workspace")
    locale               = Column(String,  nullable=False, default="fr")
    onboarding_completed = Column(Boolean, nullable=False, default=False)


class IngredientDB(Base):
    __tablename__ = "ingredients"

    id                   = Column(Integer, primary_key=True, index=True)
    tenant_id            = Column(String,  nullable=False, index=True, default="public")
    code                 = Column(String,  nullable=True,  index=True)
    name                 = Column(String,  nullable=False)
    cost                 = Column(Float,   nullable=False)
    transport_cost       = Column(Float,   nullable=False, default=0.0)
    dm                   = Column(Float,   nullable=False)
    nutrients            = Column(JSON,    default=dict)
    inventory_limit_tons = Column(Float,   nullable=False)
    is_active            = Column(Boolean, nullable=False, default=True)


class RecipeDB(Base):
    __tablename__ = "recipes"

    id                    = Column(Integer, primary_key=True, index=True)
    tenant_id             = Column(String,  nullable=False, index=True, default="public")
    code                  = Column(String,  nullable=True,  index=True)
    name                  = Column(String,  nullable=False)
    demand_tons           = Column(Float,   nullable=False)
    constraints           = Column(JSON,    default=dict)
    process_yield_percent = Column(Float,   nullable=False, default=100.0)
    bag_size_kg           = Column(Float,   nullable=False, default=50.0)
    parent_id             = Column(Integer, nullable=True) # If null, this is the master recipe
    version_tag           = Column(String,  nullable=False, default="V1")
    species               = Column(String,  nullable=False, default="General")


class AuditLogDB(Base):
    __tablename__ = "audit_logs"

    id          = Column(Integer, primary_key=True, index=True)
    tenant_id   = Column(String, nullable=False, index=True)
    user_id     = Column(String, nullable=False, index=True)
    role        = Column(String, nullable=False, default="admin")
    action      = Column(String, nullable=False, index=True)
    entity_type = Column(String, nullable=False, index=True)
    entity_id   = Column(String, nullable=True, index=True)
    metadata_   = Column("metadata", JSON, default=dict)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class OptimizationRunDB(Base):
    __tablename__ = "optimization_runs"

    id                     = Column(Integer, primary_key=True, index=True)
    tenant_id              = Column(String, nullable=False, index=True)
    user_id                = Column(String, nullable=False, index=True)
    status                 = Column(String, nullable=False, index=True)
    total_factory_cost_tnd = Column(Float, nullable=True)
    recipe_count           = Column(Integer, nullable=False, default=0)
    ingredient_count       = Column(Integer, nullable=False, default=0)
    duration_ms            = Column(Float, nullable=False, default=0.0)
    error                  = Column(Text, nullable=True)
    request_payload        = Column(JSON, default=dict)
    result_payload         = Column(JSON, default=dict)
    created_at             = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ApiEventDB(Base):
    __tablename__ = "api_events"

    id          = Column(Integer, primary_key=True, index=True)
    tenant_id   = Column(String, nullable=True, index=True)
    method      = Column(String, nullable=False)
    path        = Column(String, nullable=False, index=True)
    status_code = Column(Integer, nullable=False, index=True)
    duration_ms = Column(Float, nullable=False, default=0.0)
    error       = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
