import sys
import os

# Ensure backend module path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from db_models import IngredientDB

def update_dm():
    db = SessionLocal()
    try:
        ings = db.query(IngredientDB).all()
        updated = 0
        for ing in ings:
            nuts = ing.nutrients or {}
            
            # Look for dry matter in any language
            dm_val = None
            for key in ["Dry matter (%)", "MS %", "Matière sèche", "Dry matter"]:
                if key in nuts:
                    dm_val = nuts[key]
                    break
                
            if dm_val is not None:
                # Ensure it's a number
                try:
                    val = float(dm_val)
                    if ing.dm != val:
                        ing.dm = val
                        updated += 1
                        print(f"Updated {ing.name} dm to {val}")
                except ValueError:
                    pass
        
        db.commit()
        print(f"\nSuccessfully updated {updated} ingredients' 'dm' fields to match their JSON values!")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    update_dm()
