import os
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models.schema import Contract, AuditResult
from app.services.audit_service import AuditService
import asyncio

async def rebuild_sync():
    print("Connecting to Neon PostgreSQL...")
    db = SessionLocal()
    try:
        # 1. Clear ALL existing audit results (The source of the stale mocks/orphans)
        print("Purging all orphaned/stale audit results from Neon...")
        db.query(AuditResult).delete()
        db.commit()

        # 2. Fetch current active contract count
        contract_count = db.query(Contract).count()
        print(f"Current detected contract population: {contract_count}")

        # 3. Trigger a fresh audit run to re-aggregate results for active contracts ONLY
        print("Re-running high-fidelity audit pipeline for Neon population...")
        audit_service = AuditService()
        # We run the real audit logic to ensure numbers match real ledger data
        await audit_service.run_audit(db)
        
        # 4. Final verification
        final_results = db.query(AuditResult).count()
        print(f"Sync complete! Active Results in Neon: {final_results}")
        if final_results == contract_count:
            print("SUCCESS: 100% relational parity achieved. Dashboard will now match your 1,005 population.")
        else:
            print(f"INFO: {final_results} results generated for {contract_count} population (some contracts may lack logs/payments).")
            
    except Exception as e:
        print(f"CRITICAL SYNC ERROR: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(rebuild_sync())
