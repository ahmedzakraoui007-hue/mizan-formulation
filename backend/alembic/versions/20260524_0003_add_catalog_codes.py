"""add catalog codes to ingredients and recipes

Revision ID: 20260524_0003
Revises: 20260524_0002
Create Date: 2026-05-31
"""

from alembic import op
import sqlalchemy as sa

revision = "20260524_0003"
down_revision = "20260524_0002"
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
        if "code" not in _columns(inspector, "ingredients"):
            op.add_column("ingredients", sa.Column("code", sa.String(), nullable=True))
        inspector = sa.inspect(bind)
        if "code" in _columns(inspector, "ingredients"):
            _ensure_index(inspector, "ingredients", "code")

    if inspector.has_table("recipes"):
        if "code" not in _columns(inspector, "recipes"):
            op.add_column("recipes", sa.Column("code", sa.String(), nullable=True))
        inspector = sa.inspect(bind)
        if "code" in _columns(inspector, "recipes"):
            _ensure_index(inspector, "recipes", "code")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("recipes") and "code" in _columns(inspector, "recipes"):
        if "ix_recipes_code" in _indexes(inspector, "recipes"):
            op.drop_index("ix_recipes_code", table_name="recipes")
        op.drop_column("recipes", "code")

    inspector = sa.inspect(bind)
    if inspector.has_table("ingredients") and "code" in _columns(inspector, "ingredients"):
        if "ix_ingredients_code" in _indexes(inspector, "ingredients"):
            op.drop_index("ix_ingredients_code", table_name="ingredients")
        op.drop_column("ingredients", "code")
