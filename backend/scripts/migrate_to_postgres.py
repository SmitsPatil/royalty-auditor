import sqlite3
import os
import sys
import psycopg2

# Add backend root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker
from app.db import SQLALCHEMY_DATABASE_URL
from app.models.schema import Base, Contract, Log, Payment, AuditResult

# 1. SETUP CONNECTIONS
# SQLite Source
sqlite_path = "./lrac.db"
if not os.path.exists(sqlite_path):
    print(f"Error: {sqlite_path} not found.")
    exit(1)

# Postgres Target (from environment)
postgres_url = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
if not postgres_url or postgres_url.startswith("sqlite"):
    print("Error: POSTGRES_URL or DATABASE_URL environment variable must be set to a valid Postgres connection string.")
    print("Example: postgresql://user:password@host:port/dbname")
    exit(1)

print(f"Connecting to Postgres at: {postgres_url.split('@')[-1]}") # Log host only for safety

# SQLAlchemy setup for both
# We use separate engines for source and target
engine_sqlite = create_engine(f"sqlite:///{sqlite_path}")
engine_pg = create_engine(postgres_url)

SessionSqlite = sessionmaker(bind=engine_sqlite)
SessionPg = sessionmaker(bind=engine_pg)

def migrate():
    # 2. CREATE TABLES IN POSTGRES
    print("Creating tables in Postgres if they don't exist...")
    Base.metadata.create_all(engine_pg)
    
    session_sqlite = SessionSqlite()
    session_pg = SessionPg()
    
    try:
        # 3. MIGRATE DATA TABLE BY TABLE
        # Note: We clear existing data in the target to avoid primary key conflicts if re-running
        tables = [Contract, Log, Payment, AuditResult]
        
        for model in tables:
            table_name = model.__tablename__
            print(f"Migrating table: {table_name}...")
            
            # Fetch all from SQLite
            records = session_sqlite.query(model).all()
            total = len(records)
            print(f"  Found {total} records in SQLite.")
            
            # Batch insert into Postgres (Postgres handles batching well)
            # We clear target first for a clean migration (Optional: depends on use case)
            # session_pg.query(model).delete() 
            
            count = 0
            for record in records:
                # Merge or add? 
                # Using make_transient to treat these as new objects for the PG session
                session_pg.expunge(record) if record in session_pg else None
                # We need to create a fresh instance or use merge
                # Easiest way to clone a model instance:
                data = {c.name: getattr(record, c.name) for c in record.__table__.columns}
                new_record = model(**data)
                session_pg.add(new_record)
                
                count += 1
                if count % 500 == 0:
                    session_pg.commit()
                    print(f"  Progress: {count}/{total}")
            
            session_pg.commit()
            print(f"  Completed migration of {table_name}.\n")
            
        print("Migration fully complete! ✅")
        
    except Exception as e:
        print(f"An error occurred during migration: {e}")
        session_pg.rollback()
    finally:
        session_sqlite.close()
        session_pg.close()

if __name__ == "__main__":
    migrate()
