import sqlite3
import os
import sys
from sqlalchemy import create_engine, MetaData, text
from sqlalchemy.orm import sessionmaker

# Add backend root to path
backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(backend_root)

from app.models.schema import Base, Contract, Log, Payment, AuditResult

def migrate():
    # 1. SETUP CONNECTIONS
    sqlite_path = os.path.join(backend_root, "lrac.db")
    if not os.path.exists(sqlite_path):
        print(f"Error: {sqlite_path} not found.")
        return

    postgres_url = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
    if not postgres_url:
        print("Error: POSTGRES_URL environment variable must be set.")
        return

    print(f"Starting Migration to: {postgres_url.split('@')[-1]}")
    
    engine_sqlite = create_engine(f"sqlite:///{sqlite_path}")
    engine_pg = create_engine(postgres_url)
    
    SessionSqlite = sessionmaker(bind=engine_sqlite)
    SessionPg = sessionmaker(bind=engine_pg)
    
    # 2. PREPARE TARGET
    print("Creating/Ensuring tables in Postgres...")
    Base.metadata.create_all(engine_pg)
    
    session_sqlite = SessionSqlite()
    session_pg = SessionPg()
    
    try:
        tables = [
            (Contract, "contracts"),
            (Log, "logs"),
            (Payment, "payments"),
            (AuditResult, "audit_results")
        ]
        
        # We process in order of dependency
        for model, name in tables:
            print(f"\nProcessing table: {name}")
            
            # CLEAR TARGET (Optional, but ensures fresh start)
            print(f"  Truncating {name} in Postgres...")
            session_pg.execute(text(f"TRUNCATE TABLE {name} CASCADE"))
            session_pg.commit()
            
            # FETCH FROM SQLITE
            records = session_sqlite.query(model).all()
            total = len(records)
            print(f"  Migrating {total} records from SQLite...")
            
            # CONVERT TO DICTS AND INSERT
            # This avoids SQLAlchemy session/identity conflicts between different engines
            count = 0
            for record in records:
                # Convert object to dict of columns only
                data = {c.name: getattr(record, c.name) for c in record.__table__.columns}
                # Create a fresh instance for the PG session
                new_record = model(**data)
                session_pg.add(new_record)
                
                count += 1
                if count % 500 == 0:
                    session_pg.commit()
                    print(f"  Progress: {count}/{total}")
            
            session_pg.commit()
            print(f"  Done: {name}")

        print("\nMigration Success! ✅ All data is now in the cloud.")
        
    except Exception as e:
        print(f"Migration Error: {e}")
        session_pg.rollback()
    finally:
        session_sqlite.close()
        session_pg.close()

if __name__ == "__main__":
    migrate()
