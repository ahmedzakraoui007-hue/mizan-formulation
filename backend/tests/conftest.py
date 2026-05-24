import os
import sys
from pathlib import Path

import pytest
from fastapi import Header
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("ALLOW_DEV_TENANT", "true")
os.environ["DATABASE_URL"] = "sqlite:///./test_mizan.db"

from auth import TenantContext, get_tenant_context  # noqa: E402
from database import Base, get_db  # noqa: E402
from db_models import AuditLogDB, ApiEventDB, IngredientDB, OptimizationRunDB, RecipeDB, TenantDB  # noqa: E402
from main import app  # noqa: E402

TEST_DB_URL = "sqlite:///./test_mizan.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def override_tenant_context(
    x_test_tenant: str = Header(default="tenant-a"),
    x_test_role: str = Header(default="admin"),
):
    return TenantContext(
        tenant_id=x_test_tenant,
        user_id=f"user-{x_test_tenant}",
        role=x_test_role,
        claims={"test": True},
    )


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_tenant_context] = override_tenant_context
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
