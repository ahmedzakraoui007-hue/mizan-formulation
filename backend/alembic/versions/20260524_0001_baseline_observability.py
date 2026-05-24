"""baseline schema and observability tables

Revision ID: 20260524_0001
Revises:
Create Date: 2026-05-24
"""

from alembic import op
import sqlalchemy as sa

revision = "20260524_0001"
down_revision = None
branch_labels = None
depends_on = None


def _columns(inspector, table_name: str) -> set[str]:
    if not inspector.has_table(table_name):
        return set()
    return {col["name"] for col in inspector.get_columns(table_name)}


def _create_tenants() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("tenant_key", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("name", sa.String(), nullable=False, server_default="Mizan Workspace"),
        sa.Column("locale", sa.String(), nullable=False, server_default="fr"),
        sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def _create_ingredients() -> None:
    op.create_table(
        "ingredients",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("tenant_id", sa.String(), nullable=False, index=True, server_default="public"),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("cost", sa.Float(), nullable=False),
        sa.Column("transport_cost", sa.Float(), nullable=False, server_default="0"),
        sa.Column("dm", sa.Float(), nullable=False),
        sa.Column("nutrients", sa.JSON(), nullable=True),
        sa.Column("inventory_limit_tons", sa.Float(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def _create_recipes() -> None:
    op.create_table(
        "recipes",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("tenant_id", sa.String(), nullable=False, index=True, server_default="public"),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("demand_tons", sa.Float(), nullable=False),
        sa.Column("constraints", sa.JSON(), nullable=True),
        sa.Column("process_yield_percent", sa.Float(), nullable=False, server_default="100"),
        sa.Column("bag_size_kg", sa.Float(), nullable=False, server_default="50"),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("version_tag", sa.String(), nullable=False, server_default="V1"),
        sa.Column("species", sa.String(), nullable=False, server_default="General"),
    )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("tenants"):
        _create_tenants()

    if not inspector.has_table("ingredients"):
        _create_ingredients()
    else:
        cols = _columns(inspector, "ingredients")
        with op.batch_alter_table("ingredients") as batch:
            if "tenant_id" not in cols:
                batch.add_column(sa.Column("tenant_id", sa.String(), nullable=False, server_default="public"))
            if "transport_cost" not in cols:
                batch.add_column(sa.Column("transport_cost", sa.Float(), nullable=False, server_default="0"))
            if "is_active" not in cols:
                batch.add_column(sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))

    if not inspector.has_table("recipes"):
        _create_recipes()
    else:
        cols = _columns(inspector, "recipes")
        with op.batch_alter_table("recipes") as batch:
            if "tenant_id" not in cols:
                batch.add_column(sa.Column("tenant_id", sa.String(), nullable=False, server_default="public"))
            if "process_yield_percent" not in cols:
                batch.add_column(sa.Column("process_yield_percent", sa.Float(), nullable=False, server_default="100"))
            if "bag_size_kg" not in cols:
                batch.add_column(sa.Column("bag_size_kg", sa.Float(), nullable=False, server_default="50"))
            if "parent_id" not in cols:
                batch.add_column(sa.Column("parent_id", sa.Integer(), nullable=True))
            if "version_tag" not in cols:
                batch.add_column(sa.Column("version_tag", sa.String(), nullable=False, server_default="V1"))
            if "species" not in cols:
                batch.add_column(sa.Column("species", sa.String(), nullable=False, server_default="General"))

    if not inspector.has_table("audit_logs"):
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("tenant_id", sa.String(), nullable=False, index=True),
            sa.Column("user_id", sa.String(), nullable=False, index=True),
            sa.Column("role", sa.String(), nullable=False, server_default="admin"),
            sa.Column("action", sa.String(), nullable=False, index=True),
            sa.Column("entity_type", sa.String(), nullable=False, index=True),
            sa.Column("entity_id", sa.String(), nullable=True, index=True),
            sa.Column("metadata", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not inspector.has_table("optimization_runs"):
        op.create_table(
            "optimization_runs",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("tenant_id", sa.String(), nullable=False, index=True),
            sa.Column("user_id", sa.String(), nullable=False, index=True),
            sa.Column("status", sa.String(), nullable=False, index=True),
            sa.Column("total_factory_cost_tnd", sa.Float(), nullable=True),
            sa.Column("recipe_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("ingredient_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("duration_ms", sa.Float(), nullable=False, server_default="0"),
            sa.Column("error", sa.Text(), nullable=True),
            sa.Column("request_payload", sa.JSON(), nullable=True),
            sa.Column("result_payload", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not inspector.has_table("api_events"):
        op.create_table(
            "api_events",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("tenant_id", sa.String(), nullable=True, index=True),
            sa.Column("method", sa.String(), nullable=False),
            sa.Column("path", sa.String(), nullable=False, index=True),
            sa.Column("status_code", sa.Integer(), nullable=False, index=True),
            sa.Column("duration_ms", sa.Float(), nullable=False, server_default="0"),
            sa.Column("error", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    for table_name in ("api_events", "optimization_runs", "audit_logs"):
        op.drop_table(table_name)
