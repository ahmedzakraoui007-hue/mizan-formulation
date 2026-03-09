import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db_models import IngredientDB, RecipeDB, Base

DATABASE_URL = "sqlite:///./mizan.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_premix_and_recipe():
    session = SessionLocal()
    
    # 1. Add new ingredients
    premixes = [
        {
            "name": "CMV CF3 EXTRA",
            "cost": 3.290, # 3290 TND/T? Screenshot says 3290 per unit weight. Let's assume TND/kg. If 3290 is 3.290 TND/kg
            "inventory_limit_tons": 50.0,
            "nutrients": {
                "Matière Sèche %": 95.0,
                "Protéine %": 30.0,
                "Na g/kg": 48.9,
                "Énergie KCal/Kg": 4718.0,
                "Lysine %": 4.44,
                "Méthionine %": 6.51,
                "Calcium %": 21.86,
                "Phosphore %": 4.87,
                "M+C %": 6.51,
                "Thréonine %": 3.17
            }
        },
        {
            "name": "Vitamin Min Premix",
            "cost": 2.000,
            "inventory_limit_tons": 50.0,
            "nutrients": {
                "Matière Sèche %": 98.0,
                "Protéine %": 0.0,
                "Na g/kg": 0.0,
                "Énergie KCal/Kg": 0.0,
                "Lysine %": 0.0,
                "Méthionine %": 0.0,
                "Calcium %": 0.0,
                "Phosphore %": 0.0,
                "M+C %": 0.0,
                "Thréonine %": 0.0
            }
        }
    ]

    for item in premixes:
        existing = session.query(IngredientDB).filter(IngredientDB.name == item["name"]).first()
        if not existing:
            new_ing = IngredientDB(
                name=item["name"],
                cost=item["cost"],
                dm=item["nutrients"]["Matière Sèche %"],
                inventory_limit_tons=item["inventory_limit_tons"],
                nutrients=item["nutrients"]
            )
            session.add(new_ing)
            print(f"Added ingredient {item['name']}")
        else:
            existing.cost = item["cost"]
            existing.dm = item["nutrients"]["Matière Sèche %"]
            existing.nutrients = item["nutrients"]
            print(f"Updated ingredient {item['name']}")

    # 2. Add new recipe
    recipe_data = {
        "name": "Example 28 Broiler ***",
        "demand_tons": 10.0,
        "process_yield_percent": 100.0,
        "bag_size_kg": 50.0,
        "constraints": {
            # Ingredient bounds
            "Corn Grains": {"max": 60.0},
            "BIS BP": {"max": 8.0},
            "PAS BP": {"max": 8.0},
            "Soyabean Meal": {"min": 17.5}, # Assuming SOYA EXTR is Soyabean Meal
            "CMV CF3 EXTRA": {"min": 4.0, "max": 4.0},
            
            # Nutritional bounds
            "Protéine %": {"min": 18.0}, # Assuming a reasonable broiler minimum since screenshot was empty/cut off
            "Arginine %": {"min": 1.16}
        }
    }

    ex_recipe = session.query(RecipeDB).filter(RecipeDB.name == recipe_data["name"]).first()
    if not ex_recipe:
        new_rec = RecipeDB(
            name=recipe_data["name"],
            demand_tons=recipe_data["demand_tons"],
            process_yield_percent=recipe_data["process_yield_percent"],
            bag_size_kg=recipe_data["bag_size_kg"],
            constraints=recipe_data["constraints"]
        )
        session.add(new_rec)
        print(f"Added recipe {recipe_data['name']}")
    else:
        ex_recipe.demand_tons = recipe_data["demand_tons"]
        ex_recipe.constraints = recipe_data["constraints"]
        print(f"Updated recipe {recipe_data['name']}")

    session.commit()
    print("Seeding complete.")
    session.close()

if __name__ == "__main__":
    seed_premix_and_recipe()
