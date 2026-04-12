import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db_models import IngredientDB
from dotenv import load_dotenv

def normalize_database():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    if not db_url:
        db_url = "sqlite:///./mizan.db"

    engine = create_engine(db_url, connect_args={"check_same_thread": False} if "sqlite" in db_url else {})
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    key_map = {
        "Crude protein": ("Protéine %", 1),
        "Crude fibre": ("Fibre %", 1),
        "Gross energy (kcal)": ("Énergie KCal/Kg", 1),
        "Crude fat": ("Matière Grasse %", 1),
        "Ash": ("Cendres %", 1),
        "Dry matter": ("Matière Sèche %", 1),

        # Minerals & Amino Acids in INRAE are stored in g/kg. Divide by 10 for %.
        "Calcium": ("Calcium %", 10),
        "Phosphorus": ("Phosphore %", 10),
        "Sodium": ("Sodium %", 10),
        "Chlorine": ("Chlore %", 10),
        "Lysine": ("Lysine %", 10),
        "Methionine": ("Méthionine %", 10),
        "Methionine + cystine": ("M+C %", 10),
        "Threonine": ("Thréonine %", 10),
        "Cystine": ("Cystine %", 10),
        "Tryptophan": ("Tryptophane %", 10),
        "Isoleucine": ("Isoleucine %", 10),
        "Valine": ("Valine %", 10),
        "Leucine": ("Leucine %", 10),
        "Arginine": ("Arginine %", 10)
    }

    try:
        ingredients = db.query(IngredientDB).all()
        updated_count = 0

        for ing in ingredients:
            if not ing.nutrients:
                continue

            new_nutrients = {}
            for old_k, old_v in ing.nutrients.items():
                if old_k in key_map:
                    new_key, div_factor = key_map[old_k]
                    new_nutrients[new_key] = old_v / div_factor
                else:
                    new_nutrients[old_k] = old_v

            # Safe update detection
            if new_nutrients != ing.nutrients:
                ing.nutrients = new_nutrients
                updated_count += 1

        db.commit()
        print(f"Successfully normalized nomenclature and values for {updated_count} ingredients!")

    except Exception as e:
        db.rollback()
        print(f"Error validating DB: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    normalize_database()
