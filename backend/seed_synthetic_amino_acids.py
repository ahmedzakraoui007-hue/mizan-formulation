import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db_models import IngredientDB, Base

DATABASE_URL = "sqlite:///./mizan.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_synthetic_amino_acids():
    session = SessionLocal()
    
    synthetic_ingredients = [
        {
            "name": "L-Lysine HCL",
            "price_tnd_per_kg": 4.500,
            "transport_cost": 0.0,
            "inventory_limit_tons": 5.0,
            "nutrients": {
                "Matière Sèche %": 99.0,
                "Protéine %": 94.0,
                "Lysine %": 78.0
            }
        },
        {
            "name": "DL-Méthionine",
            "price_tnd_per_kg": 7.200,
            "transport_cost": 0.0,
            "inventory_limit_tons": 3.0,
            "nutrients": {
                "Matière Sèche %": 99.0,
                "Protéine %": 58.0,
                "Méthionine %": 99.0,
                "M+C %": 99.0
            }
        },
        {
            "name": "L-Thréonine",
            "price_tnd_per_kg": 3.800,
            "transport_cost": 0.0,
            "inventory_limit_tons": 2.0,
            "nutrients": {
                "Matière Sèche %": 99.0,
                "Protéine %": 72.0,
                "Thréonine %": 98.0
            }
        },
        {
            "name": "L-Valine",
            "price_tnd_per_kg": 15.000,
            "transport_cost": 0.0,
            "inventory_limit_tons": 1.0,
            "nutrients": {
                "Matière Sèche %": 99.0,
                "Protéine %": 72.0,
                "Valine %": 98.0
            }
        },
        {
            "name": "Carbonate de Calcium",
            "price_tnd_per_kg": 0.080,
            "transport_cost": 0.0,
            "inventory_limit_tons": 20.0,
            "nutrients": {
                "Matière Sèche %": 99.0,
                "Calcium %": 38.0
            }
        },
        {
            "name": "Phosphate Bicalcique (MCP)",
            "price_tnd_per_kg": 1.800,
            "transport_cost": 0.0,
            "inventory_limit_tons": 10.0,
            "nutrients": {
                "Matière Sèche %": 97.0,
                "Calcium %": 16.0,
                "Phosphore %": 22.7
            }
        }
    ]

    for item in synthetic_ingredients:
        existing = session.query(IngredientDB).filter(IngredientDB.name == item["name"]).first()
        if not existing:
            new_ing = IngredientDB(
                name=item["name"],
                cost=item["price_tnd_per_kg"],
                transport_cost=item["transport_cost"],
                dm=item["nutrients"]["Matière Sèche %"],
                inventory_limit_tons=item["inventory_limit_tons"],
                nutrients=item["nutrients"]
            )
            session.add(new_ing)
            print(f"Added {item['name']}")
        else:
            print(f"Updated {item['name']}")
            existing.cost = item["price_tnd_per_kg"]
            existing.transport_cost = item["transport_cost"]
            existing.dm = item["nutrients"]["Matière Sèche %"]
            existing.nutrients = item["nutrients"]
    
    session.commit()
    print("Synthetic Amino Acids Seeding complete.")
    session.close()

if __name__ == "__main__":
    seed_synthetic_amino_acids()
