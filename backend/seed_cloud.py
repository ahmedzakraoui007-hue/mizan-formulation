import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db_models import IngredientDB, Base

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL or "sqlite" in DATABASE_URL.lower():
    print("\n[!] CRITICAL WARNING: Target Database Invalid")
    print("    DATABASE_URL is either missing or points to a local SQLite database.")
    print("    This script is strictly intended for seeding the remote PostgreSQL cloud database.")
    print("    Please set a valid Postgres DATABASE_URL in your .env file before running.")
    sys.exit(1)

# SQLAlchemy 1.4+ requires `postgresql://` instead of `postgres://`
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Phase 3: The Consolidated Dataset
ingredients_data = [
    # --- Premixes ---
    {
        "name": "CMV CF3 EXTRA",
        "cost": 3.290,
        "transport_cost": 0.0,
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
        "transport_cost": 0.0,
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
    },
    # --- Soya ---
    {
        "name": "SOYA EXTR",
        "cost": 1.775,
        "transport_cost": 0.0,
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
    },
    # --- Synthetic Amino Acids & Minerals ---
    {
        "name": "L-Lysine HCL",
        "cost": 4.500,
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
        "cost": 7.200,
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
        "cost": 3.800,
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
        "cost": 15.000,
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
        "cost": 0.080,
        "transport_cost": 0.0,
        "inventory_limit_tons": 20.0,
        "nutrients": {
            "Matière Sèche %": 99.0,
            "Calcium %": 38.0
        }
    },
    {
        "name": "Phosphate Bicalcique (MCP)",
        "cost": 1.800,
        "transport_cost": 0.0,
        "inventory_limit_tons": 10.0,
        "nutrients": {
            "Matière Sèche %": 97.0,
            "Calcium %": 16.0,
            "Phosphore %": 22.7
        }
    },
    # --- Legacy Cereals & Base Ingredients ---
    {
        "name": "Corn Grains",
        "cost": 0.870,
        "transport_cost": 0.0,
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
        "cost": 1.200,
        "transport_cost": 0.0,
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
        "cost": 1.350,
        "transport_cost": 0.0,
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
        "cost": 0.630,
        "transport_cost": 0.0,
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
        "cost": 0.350,
        "transport_cost": 0.0,
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

def seed_cloud():
    # Attempt to create relevant tables if they don't exist in the remote DB yet
    Base.metadata.create_all(bind=engine)
    
    session = SessionLocal()
    
    # Phase 4: Upsert Logic
    for item in ingredients_data:
        existing = session.query(IngredientDB).filter(IngredientDB.name == item["name"]).first()
        
        if not existing:
            new_ing = IngredientDB(
                name=item["name"],
                cost=item["cost"],
                transport_cost=item.get("transport_cost", 0.0),
                dm=item["nutrients"]["Matière Sèche %"],
                inventory_limit_tons=item["inventory_limit_tons"],
                nutrients=item["nutrients"]
            )
            session.add(new_ing)
            print(f"[+] Added new ingredient: {item['name']}")
        else:
            existing.cost = item["cost"]
            existing.transport_cost = item.get("transport_cost", 0.0)
            existing.dm = item["nutrients"]["Matière Sèche %"]
            existing.nutrients = item["nutrients"]
            print(f"[*] Updated existing ingredient: {item['name']}")
    
    session.commit()
    print("\n✅ Cloud PostgreSQL Database Seeding Complete!")
    session.close()

if __name__ == "__main__":
    seed_cloud()
