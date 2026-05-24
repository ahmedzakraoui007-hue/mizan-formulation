from pathlib import Path

from alembic import command
from alembic.config import Config


def run_migrations() -> None:
    alembic_ini = Path(__file__).with_name("alembic.ini")
    config = Config(str(alembic_ini))
    config.set_main_option("script_location", str(alembic_ini.parent / "alembic"))
    command.upgrade(config, "head")
