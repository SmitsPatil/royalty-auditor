import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

try:
    from backend.app.db import SessionLocal
    from backend.app.services.audit_service import AuditService
    from backend.app.models.schema import Contract, AuditResult
    import asyncio

    async def main():
        db = SessionLocal()
        svc = AuditService()
        
        # 1. Check contracts
        count = db.query(Contract).count()
        print(f"Contracts in DB: {count}")
        
        if count == 0:
            print("No contracts found. Migration might have failed.")
            return

        # 2. Run a small audit (10 contracts)
        print("Running audit for first 10 contracts...")
        contracts = db.query(Contract).limit(10).all()
        # Since run_audit is async, we call it
        await svc.run_audit(db)
        
        # 3. Check results
        res_count = db.query(AuditResult).count()
        print(f"Audit Results in DB: {res_count}")
        
        db.close()

    if __name__ == "__main__":
        asyncio.run(main())

except Exception as e:
    print(f"CRASH: {e}")
    import traceback
    traceback.print_exc()
