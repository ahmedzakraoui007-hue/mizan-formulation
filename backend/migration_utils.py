from pathlib import Path

from alembic import command
from alembic.config import Config


def run_migrations() -> None:
    alembic_ini = Path(__file__).with_name("alembic.ini")
    command.upgrade(Config(str(alembic_ini)), "head")
