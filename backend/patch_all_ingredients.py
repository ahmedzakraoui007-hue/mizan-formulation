import sys
import os
import json
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, base_dir)
from db_models import IngredientDB

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL or not DATABASE_URL.startswith(("postgresql://", "postgres://")):
    raise RuntimeError("Set DATABASE_URL to the target PostgreSQL database before running this patch script.")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    ings = db.query(IngredientDB).all()
    patched_count = 0
    
    inrae_file = os.path.join(base_dir, "inrae_scraped_data_full.json")
    if os.path.exists(inrae_file):
        with open(inrae_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        for ing in ings:
            if not ing.nutrients or len(ing.nutrients.keys()) < 10:
                # Find it in INRAE JSON
                match = next((item for item in data if item["name"].strip().lower() in ing.name.strip().lower() or ing.name.strip().lower() in item["name"].strip().lower()), None)
                if match and "nutrients" in match:
                    new_nutrients = match["nutrients"]
                    if ing.nutrients:
                        for k, v in ing.nutrients.items():
                            if k not in new_nutrients:
                                new_nutrients[k] = v
                                
                    ing.nutrients = new_nutrients
                    if "Dry matter" in match:
                        ing.dm = float(match["Dry matter"])
                    
                    patched_count += 1
                    print(f" -> Patched {ing.name} with {len(new_nutrients.keys())} parameters")
                else:
                    print(f" -> ❌ {ing.name} not found in JSON data")
                    
        if patched_count > 0:
            db.commit()
            print(f"✅ Successfully patched {patched_count} MORE ingredients in Neon DB!")
    else:
        print("❌ inrae_scraped_data_full.json not found")
finally:
    db.close()
