import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

# Database URL from environment or local fallback
# Vercel provides POSTGRES_URL, others often use DATABASE_URL
# Neon URL from seeding scripts
NEON_URL = "postgresql://neondb_owner:npg_9DqiwJCehv3H@ep-twilight-morning-am8zdxj4-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Database URL from environment or fallback to Neon
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", os.getenv("POSTGRES_URL", NEON_URL))

# Ensure postgresql:// is used
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Connect args (needed only for SQLite fallback, now deactivated but kept for safety)
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator:
    """FastAPI dependency — returns a SQLAlchemy Session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
