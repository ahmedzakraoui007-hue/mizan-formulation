import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db_models import IngredientDB, Base

DATABASE_URL = "sqlite:///./mizan.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_legacy_data():
    session = SessionLocal()
    
    legacy_ingredients = [
        {
            "name": "Corn Grains",
            "price_tnd_per_kg": 0.870,
            "inventory_limit_tons": 500.0,
            "nutrients": {
                "Matière Sèche %": 86.3,
                "Protéine %": 7.6,
                "Énergie KCal/Kg": 3090.0,
                "Lysine %": 0.21,
                "Méthionine %": 0.15,
                "Calcium %": 0.02,
                "Phosphore %": 0.28,
                "M+C %": 0.32,
                "Thréonine %": 0.24,
                "Valine %": 0.35,
                "Leucine %": 0.87,
                "Arginine %": 0.34
            }
        },
        {
            "name": "Wheat Grains",
            "price_tnd_per_kg": 1.200,  # Interpreting 120 as 1200 TND/T due to market realities
            "inventory_limit_tons": 200.0,
            "nutrients": {
                "Matière Sèche %": 87.0,
                "Protéine %": 14.1,
                "Énergie KCal/Kg": 3220.0,
                "Lysine %": 0.31,
                "Méthionine %": 0.20,
                "Calcium %": 0.05,
                "Phosphore %": 0.37,
                "M+C %": 0.0,
                "Thréonine %": 0.0,
                "Valine %": 0.0,
                "Leucine %": 0.0,
                "Arginine %": 0.0
            }
        },
        {
            "name": "Soyabean Meal",
            "price_tnd_per_kg": 1.350,
            "inventory_limit_tons": 300.0,
            "nutrients": {
                "Matière Sèche %": 88.0,
                "Protéine %": 46.2,
                "Na g/kg": 0.2,
                "Énergie KCal/Kg": 2260.0,
                "Lysine %": 2.53,
                "Méthionine %": 0.59,
                "Calcium %": 0.34,
                "Phosphore %": 0.62,
                "M+C %": 1.14,
                "Thréonine %": 1.47,
                "Valine %": 1.92,
                "Leucine %": 3.07,
                "Arginine %": 3.04
            }
        },
        {
            "name": "BIS BP",
            "price_tnd_per_kg": 0.630,
            "inventory_limit_tons": 100.0,
            "nutrients": {
                "Matière Sèche %": 91.0,
                "Protéine %": 9.6,
                "Na g/kg": 5.4,
                "Énergie KCal/Kg": 3420.0,
                "Lysine %": 0.21,
                "Méthionine %": 0.11,
                "Calcium %": 0.08,
                "Phosphore %": 0.15,
                "M+C %": 0.26,
                "Thréonine %": 0.18,
                "Valine %": 0.33,
                "Leucine %": 0.53,
                "Arginine %": 0.28
            }
        },
        {
            "name": "PAS BP",
            "price_tnd_per_kg": 0.350,
            "inventory_limit_tons": 100.0,
            "nutrients": {
                "Matière Sèche %": 91.0,
                "Protéine %": 12.0,
                "Na g/kg": 5.0,
                "Énergie KCal/Kg": 3080.0,
                "Lysine %": 0.49,
                "Méthionine %": 0.20,
                "Calcium %": 0.11,
                "Phosphore %": 0.80,
                "M+C %": 0.45,
                "Thréonine %": 0.38,
                "Valine %": 0.56,
                "Leucine %": 0.77,
                "Arginine %": 0.81
            }
        }
    ]

    for item in legacy_ingredients:
        existing = session.query(IngredientDB).filter(IngredientDB.name == item["name"]).first()
        if not existing:
            new_ing = IngredientDB(
                name=item["name"],
                cost=item["price_tnd_per_kg"],
                dm=item["nutrients"]["Matière Sèche %"],
                inventory_limit_tons=item["inventory_limit_tons"],
                nutrients=item["nutrients"]
            )
            session.add(new_ing)
            print(f"Added {item['name']}")
        else:
            print(f"Updated {item['name']}")
            existing.cost = item["price_tnd_per_kg"]
            existing.dm = item["nutrients"]["Matière Sèche %"]
            existing.nutrients = item["nutrients"]
    
    session.commit()
    print("Seeding complete.")
    session.close()

if __name__ == "__main__":
    seed_legacy_data()

