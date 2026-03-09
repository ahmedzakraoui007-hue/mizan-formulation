import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db_models import IngredientDB, Base

DATABASE_URL = "sqlite:///./mizan.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_pas_bp():
    session = SessionLocal()
    
    pas_bp = {
        "name": "PAS BP",
        "price_tnd_per_kg": 0.350,
        "transport_cost": 0.0,
        "inventory_limit_tons": 100.0,  # Adding 100t by default for the demo
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

    existing = session.query(IngredientDB).filter(IngredientDB.name == pas_bp["name"]).first()
    if not existing:
        new_ing = IngredientDB(
            name=pas_bp["name"],
            cost=pas_bp["price_tnd_per_kg"],
            transport_cost=pas_bp["transport_cost"],
            dm=pas_bp["nutrients"]["Matière Sèche %"],
            inventory_limit_tons=pas_bp["inventory_limit_tons"],
            nutrients=pas_bp["nutrients"]
        )
        session.add(new_ing)
        print(f"Added {pas_bp['name']}")
    else:
        print(f"Updated {pas_bp['name']}")
        existing.cost = pas_bp["price_tnd_per_kg"]
        existing.transport_cost = pas_bp["transport_cost"]
        existing.dm = pas_bp["nutrients"]["Matière Sèche %"]
        existing.nutrients = pas_bp["nutrients"]
    
    session.commit()
    print("PAS BP Seeding complete.")
    session.close()

if __name__ == "__main__":
    seed_pas_bp()
