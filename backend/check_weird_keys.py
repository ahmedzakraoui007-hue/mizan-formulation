import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import SessionLocal
from db_models import IngredientDB, RecipeDB

db = SessionLocal()
try:
    ings = db.query(IngredientDB).all()
    print("Ingredients with weird nutrient keys:")
    for ing in ings:
        if not ing.nutrients: continue
        for k in ing.nutrients.keys():
            if k.lower() in ["maize", "biscuit byproduct", "wheat bran"]:
                print(f"Ingredient {ing.name} has nutrient key: {k}")

    recs = db.query(RecipeDB).all()
    print("\nRecipes with weird target keys:")
    for rec in recs:
        if not rec.constraints: continue
        for k in rec.constraints.keys():
            if k.lower() in ["maize", "biscuit byproduct", "wheat bran"]:
                print(f"Recipe {rec.name} has weird constraint key: {k}")

finally:
    db.close()
