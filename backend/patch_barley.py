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
    barley = db.query(IngredientDB).filter(IngredientDB.name == "Barley").first()
    if barley:
        inrae_file = os.path.join(base_dir, "inrae_scraped_data_full.json")
        if os.path.exists(inrae_file):
            with open(inrae_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            barley_data = next((item for item in data if item["name"] == "Barley"), None)
            if barley_data and "nutrients" in barley_data:
                new_nutrients = barley_data["nutrients"]
                barley.nutrients = new_nutrients
                if "Dry matter" in barley_data:
                    barley.dm = float(barley_data["Dry matter"])
                
                db.commit()
                print(f"✅ Successfully patched Barley with {len(new_nutrients.keys())} parameters in Neon DB!")
            else:
                print("❌ Barley not found in JSON data")
        else:
            print("❌ inrae_scraped_data_full.json not found")
    else:
        print("❌ Barley not found in Neon Database")
finally:
    db.close()
