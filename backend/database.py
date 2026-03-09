import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

# Connect args specific to SQLite (needed because FastAPI threads might share an in-memory session)
connect_args = {}

if DATABASE_URL:
    # SQLAlchemy 1.4+ requires `postgresql://` instead of `postgres://`
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
else:
    # SQLite for local fallback — swap to PostgreSQL URL when deploying
    DATABASE_URL = "sqlite:///./mizan.db"
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
