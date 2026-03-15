import json
import logging
from database import engine, SessionLocal, Base
from db_models import IngredientDB

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

def seed_inrae_data():
    """Seeds the database with INRAE scraped data."""
    logging.info("Starting database seeding process...")
    
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    logging.info("Database tables verified.")

    # Load JSON data
    input_file = "inrae_scraped_data.json"
    try:
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        logging.info(f"Successfully loaded {len(data)} records from {input_file}.")
    except Exception as e:
        logging.error(f"Failed to read {input_file}: {e}")
        return

    if not data:
        logging.warning("No data found in JSON file. Exiting.")
        return

    db = SessionLocal()
    try:
        # Idempotency: Extract all ingredient names from the JSON
        names_to_insert = [item["name"] for item in data]
        
        # Query for existing records with these names
        existing_ingredients = db.query(IngredientDB).filter(IngredientDB.name.in_(names_to_insert)).all()
        
        if existing_ingredients:
            # Delete existing duplicates
            logging.info(f"Found {len(existing_ingredients)} existing ingredients. Deleting old duplicates...")
            for ingredient in existing_ingredients:
                db.delete(ingredient)
            db.commit()
            logging.info(f"Deleted old duplicates.")
        else:
            logging.info("No existing duplicates found.")

        # Bulk Insert
        logging.info("Preparing new ingredient objects...")
        new_ingredients = []
        for item in data:
            ingredient = IngredientDB(
                name=item["name"],
                cost=item.get("cost", 1.0),
                transport_cost=item.get("transport_cost", 0.05),
                dm=item.get("dm", 88.0),
                inventory_limit_tons=item.get("inventory_limit_tons", 50.0),
                nutrients=item.get("nutrients", {})
            )
            new_ingredients.append(ingredient)

        # Insert efficiently using add_all
        db.add_all(new_ingredients)
        db.commit()
        logging.info(f"Inserted {len(new_ingredients)} ingredients successfully.")

    except Exception as e:
        logging.error(f"Database error during seeding: {e}")
        db.rollback()
        logging.info("Database transaction rolled back due to error.")
    finally:
        db.close()
        logging.info("Database connection closed.")

if __name__ == "__main__":
    seed_inrae_data()
