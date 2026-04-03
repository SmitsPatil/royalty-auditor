import os, sys
# Add backend to path
backend_path = os.path.join(os.getcwd(), 'backend')
sys.path.insert(0, backend_path)

try:
    from app.db import engine
    from sqlalchemy import text
    with engine.connect() as conn:
        res = conn.execute(text("SELECT 1"))
        print(f"Connection Successful! Result: {res.scalar()}")
except Exception as e:
    print(f"Connection Failed: {e}")
