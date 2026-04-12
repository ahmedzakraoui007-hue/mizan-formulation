import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db_models import IngredientDB
from dotenv import load_dotenv

def wipe_transport_costs():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    
    if not db_url:
        db_url = "sqlite:///./mizan.db"
        print("Using local SQLite database...")
        engine = create_engine(db_url, connect_args={"check_same_thread": False})
    else:
        print("Using PostgreSQL Cloud Database...")
        engine = create_engine(db_url)
        
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        ingredients = db.query(IngredientDB).all()
        updated_count = 0
        for ing in ingredients:
            if ing.transport_cost == 0.05:
                ing.transport_cost = 0.0
                updated_count += 1
        
        if updated_count > 0:
            db.commit()
            print(f"Patched! Removed 0.05 transport cost from {updated_count} ingredients.")
        else:
            print("No ingredients found with 0.05 transport cost.")
    except Exception as e:
        print(f"Error updating DB: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    wipe_transport_costs()
