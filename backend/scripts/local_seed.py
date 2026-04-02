import os
import sys
import csv
import sqlite3

# Add backend root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.schema import Base, Contract, Log, Payment

# 1. SETUP
DB_PATH = "lrac.db"
engine = create_engine(f"sqlite:///{DB_PATH}")
Session = sessionmaker(bind=engine)
session = Session()

def seed_from_csv(file_path, model):
    print(f"Seeding {model.__tablename__} from {file_path}...")
    # Clear existing data in SQLite
    session.query(model).delete()
    
    with open(file_path, "r") as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            # Create instance
            # Note: We need to handle type conversions if necessary, 
            # but SQLAlchemy handles most string/float/int mapping automatically from DictReader.
            instance = model(**row)
            session.add(instance)
            count += 1
            if count % 1000 == 0:
                session.commit()
                print(f"  Inserted {count}...")
        
    session.commit()
    print(f"Done. Total: {count}\n")

if __name__ == "__main__":
    # Create tables if not exist
    Base.metadata.create_all(engine)
    
    try:
        seed_from_csv("contracts_1000.csv", Contract)
        seed_from_csv("streaming_logs_13k.csv", Log)
        seed_from_csv("payments_ledger.csv", Payment)
        print("Local SQLite (lrac.db) has been adjusted to 1k/5k/13k records! ✅")
    except Exception as e:
        print(f"Error seeding: {e}")
        session.rollback()
    finally:
        session.close()
