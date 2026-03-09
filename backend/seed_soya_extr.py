from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db_models import IngredientDB, Base

DATABASE_URL = "sqlite:///./mizan.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_soya_extr():
    session = SessionLocal()
    
    ingredient_data = {
        "name": "SOYA EXTR",
        "cost": 1.775, # 1775 Price /unit weight, assuming TND/kg is 1.775 or 1775 depending on scale. Let's use 1.775
        "inventory_limit_tons": 50.0,
        "nutrients": {
            "Matière Sèche %": 99.0,
            "Protéine %": 36.0,
            "Na g/kg": 0.05,
            "Énergie KCal/Kg": 3420.0,
            "Lysine %": 1.9,
            "Méthionine %": 0.44,
            "Calcium %": 0.3,
            "Phosphore %": 0.56,
            "M+C %": 0.8,
            "Thréonine %": 1.12,
            "Valine %": 1.42,
            "Leucine %": 2.25,
            "Arginine %": 2.29
        }
    }

    existing = session.query(IngredientDB).filter(IngredientDB.name == ingredient_data["name"]).first()
    if not existing:
        new_ing = IngredientDB(
            name=ingredient_data["name"],
            cost=ingredient_data["cost"],
            dm=ingredient_data["nutrients"]["Matière Sèche %"],
            inventory_limit_tons=ingredient_data["inventory_limit_tons"],
            nutrients=ingredient_data["nutrients"]
        )
        session.add(new_ing)
        print(f"Added ingredient {ingredient_data['name']}")
    else:
        existing.cost = ingredient_data["cost"]
        existing.dm = ingredient_data["nutrients"]["Matière Sèche %"]
        existing.nutrients = ingredient_data["nutrients"]
        print(f"Updated ingredient {ingredient_data['name']}")

    session.commit()
    print("SOYA EXTR Seeding complete.")
    session.close()

if __name__ == "__main__":
    seed_soya_extr()
