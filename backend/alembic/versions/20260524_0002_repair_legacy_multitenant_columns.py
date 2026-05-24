"""repair legacy multi-tenant columns

Revision ID: 20260524_0002
Revises: 20260524_0001
Create Date: 2026-05-24
"""

from alembic import op
import sqlalchemy as sa

revision = "20260524_0002"
down_revision = "20260524_0001"
branch_labels = None
depends_on = None


def _columns(inspector, table_name: str) -> set[str]:
    if not inspector.has_table(table_name):
        return set()
    return {col["name"] for col in inspector.get_columns(table_name)}


def _indexes(inspector, table_name: str) -> set[str]:
    if not inspector.has_table(table_name):
        return set()
    return {idx["name"] for idx in inspector.get_indexes(table_name)}


def _ensure_index(inspector, table_name: str, column_name: str) -> None:
    index_name = f"ix_{table_name}_{column_name}"
    if index_name not in _indexes(inspector, table_name):
        op.create_index(index_name, table_name, [column_name])


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("ingredients"):
        cols = _columns(inspector, "ingredients")
        if "tenant_id" not in cols:
            op.add_column("ingredients", sa.Column("tenant_id", sa.String(), nullable=False, server_default="public"))
        if "transport_cost" not in cols:
            op.add_column("ingredients", sa.Column("transport_cost", sa.Float(), nullable=False, server_default="0"))
        if "is_active" not in cols:
            op.add_column("ingredients", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))

        inspector = sa.inspect(bind)
        if "tenant_id" in _columns(inspector, "ingredients"):
            _ensure_index(inspector, "ingredients", "tenant_id")

    if inspector.has_table("recipes"):
        cols = _columns(inspector, "recipes")
        if "tenant_id" not in cols:
            op.add_column("recipes", sa.Column("tenant_id", sa.String(), nullable=False, server_default="public"))
        if "process_yield_percent" not in cols:
            op.add_column("recipes", sa.Column("process_yield_percent", sa.Float(), nullable=False, server_default="100"))
        if "bag_size_kg" not in cols:
            op.add_column("recipes", sa.Column("bag_size_kg", sa.Float(), nullable=False, server_default="50"))
        if "parent_id" not in cols:
            op.add_column("recipes", sa.Column("parent_id", sa.Integer(), nullable=True))
        if "version_tag" not in cols:
            op.add_column("recipes", sa.Column("version_tag", sa.String(), nullable=False, server_default="V1"))
        if "species" not in cols:
            op.add_column("recipes", sa.Column("species", sa.String(), nullable=False, server_default="General"))

        inspector = sa.inspect(bind)
        if "tenant_id" in _columns(inspector, "recipes"):
            _ensure_index(inspector, "recipes", "tenant_id")


def downgrade() -> None:
    pass
