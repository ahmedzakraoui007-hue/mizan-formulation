import sys
import os
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, base_dir)
from db_models import IngredientDB

NEON_URL = "postgresql://neondb_owner:npg_GKdtDsM46qli@ep-plain-queen-aly72j4l-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
engine = create_engine(NEON_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    ing = db.query(IngredientDB).filter(IngredientDB.name == "cmv cf3 xtra 4%").first()
    if ing and ing.nutrients:
        # Print the keys that might be problematic
        for k in ing.nutrients.keys():
            if 'adf' in k.lower() or 'starch' in k.lower() or 'sugar' in k.lower() or 'lignin' in k.lower() or 'cell wall' in k.lower():
                print(f"KEY: '{k}'")
finally:
    db.close()
