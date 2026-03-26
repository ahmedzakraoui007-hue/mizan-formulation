import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import SessionLocal
from db_models import IngredientDB, RecipeDB
from solver import solve_multi_blend
from main import MultiBlendIngredient, RecipeDemand

db = SessionLocal()
try:
    recs = db.query(RecipeDB).all()
    print("All recipes in DB:")
    for r in recs:
        print(f" - {r.name}")
finally:
        ings = db.query(IngredientDB).all()
        # Ensure is_active is True
        ing_objs = [MultiBlendIngredient(
            name=i.name, cost=i.cost, transport_cost=i.transport_cost, dm=i.dm,
            nutrients=i.nutrients, inventory_limit_tons=i.inventory_limit_tons,
            is_active=getattr(i, 'is_active', True)
        ) for i in ings]
        
        # Take the first matched recipe
        rec_objs = [RecipeDemand(
            name=recs[0].name, demand_tons=recs[0].demand_tons, process_yield_percent=recs[0].process_yield_percent,
            bag_size_kg=recs[0].bag_size_kg, constraints=recs[0].constraints, species=recs[0].species
        )]

        print("\n------- RUNNING SOLVER -------")
        try:
            result = solve_multi_blend(ing_objs, rec_objs)
            print("\n------- SOLVER SUCCESS ! -------")
        except Exception as e:
            print(f"\n------- SOLVER FAILED -------: {e}")
finally:
    db.close()
