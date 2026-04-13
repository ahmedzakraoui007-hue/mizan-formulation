import json
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db_models import IngredientDB
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
if not db_url:
    db_url = "sqlite:///./mizan.db"

engine = create_engine(db_url, connect_args={"check_same_thread": False} if "sqlite" in db_url else {})
Session = sessionmaker(bind=engine)
db = Session()

ing = db.query(IngredientDB).first()
if ing:
    print("INGREDIENT:", ing.name)
    print("NUTRIENTS:", json.dumps(ing.nutrients, indent=2))
else:
    print("NO INGREDIENTS")
db.close()
