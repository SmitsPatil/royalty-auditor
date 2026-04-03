import os
import sys
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal, engine
from app.models.schema import Base, Contract, Log, Payment, AuditResult
from app.services.audit_service import AuditService
import asyncio

def random_date(start, end):
    return start + timedelta(days=random.randint(0, int((end - start).days)))

async def perform_dataset_reset(db: Session):
    """
    ABSOLUTE FINAL CALIBRATION.
    Ensures 0% territory/date noise. 
    100% variance controlled by payments.
    Target: 100 Under (~₹2.5k total), 250 Over, 650 OK.
    """
    print("--- 1. Purging existing dataset (Atomic) ---")
    try:
        # Delete in correct order for safety
        db.query(AuditResult).delete()
        db.query(Log).delete()
        db.query(Payment).delete()
        db.query(Contract).delete()
        db.commit()
    except Exception as e:
        db.rollback()
        raise e

    territories = ['US', 'IN', 'UK', 'CA', 'DE', 'JP', 'BR', 'AU', 'FR']
    studios = ['StudioA', 'StudioB', 'StudioC', 'StudioD']
    categories = ['Movie', 'Song', 'Podcast', 'Audiobook', 'Series']
    
    start_of_2023 = datetime(2023, 1, 1)
    end_of_2026 = datetime(2026, 12, 31)

    # 1. PHASE 1: GENERATE CONTRACTS (1,000)
    print("--- 2. Generating 1,000 Contracts ---")
    contracts = []
    indices = list(range(0, 1000))
    random.shuffle(indices)
    
    under_indices = set(indices[:100])
    over_indices = set(indices[100:350])
    
    for i in range(1, 1001):
        c_id = f"C{i:04d}"
        category = random.choice(categories)
        t = random.choice(territories)
        
        c = Contract(
            contract_id=c_id,
            content_id=f"{category}_{random.randint(100, 999)}",
            studio=random.choice(studios),
            royalty_rate=round(random.uniform(5.0, 15.0), 2),
            rate_per_play=round(random.uniform(0.01, 0.05), 4),
            tier_rate=round(random.uniform(0.05, 0.1), 4),
            tier_threshold=random.randint(500, 2000),
            territory=t,
            start_date=random_date(start_of_2023, datetime(2024, 12, 31)).strftime("%Y-%m-%d"),
            end_date=random_date(datetime(2026, 1, 1), end_of_2026).strftime("%Y-%m-%d"),
            is_deleted=0
        )
        db.add(c)
        contracts.append(c)
    db.commit()

    # 2. PHASE 2: GENERATE LOGS (13,000)
    # Ensure zero invalid logs
    print("--- 3. Generating 13,000 Zero-Noise Logs ---")
    plays_per_contract = {c.contract_id: 0 for c in contracts}
    for i in range(1, 13001):
        target_c = random.choice(contracts)
        plays = random.randint(1, 500)
        
        s_dt = datetime.strptime(target_c.start_date, "%Y-%m-%d")
        e_dt = datetime.strptime(target_c.end_date, "%Y-%m-%d")
        
        l = Log(
            play_id=f"L{i:06d}",
            contract_id=target_c.contract_id,
            content_id=target_c.content_id,
            timestamp=random_date(s_dt, e_dt).strftime("%Y-%m-%dT%H:%M:%SZ"),
            country=target_c.territory, # Strict match
            plays=plays,
            user_type=random.choice(['free', 'premium']),
            device=random.choice(['mobile', 'web', 'tv'])
        )
        db.add(l)
        plays_per_contract[target_c.contract_id] += plays
        if i % 3000 == 0:
            db.commit()
    db.commit()

    # 3. PHASE 3: PRECISION PAYMENTS (5,000)
    print("--- 4. Generating 5,000 Calibrated Payments ---")
    payment_counter = 1
    total_leakage_acc = 0
    
    for i, c in enumerate(contracts):
        plays = plays_per_contract[c.contract_id]
        # Exact expected logic
        if plays > c.tier_threshold and c.tier_threshold > 0:
            expected = (c.tier_threshold * c.rate_per_play) + ((plays - c.tier_threshold) * c.tier_rate)
        else:
            expected = plays * c.rate_per_play
            
        if i in under_indices:
            # Underpaid (Target: approx ₹25 leakage per contract for 100 contracts = ₹2.5k)
            variance = random.uniform(20.0, 30.0)
            total_paid = max(0, expected - variance)
            total_leakage_acc += abs(total_paid - expected)
        elif i in over_indices:
            # Overpaid
            variance = random.uniform(1.0, 10.0)
            total_paid = expected + variance
        else:
            # Clean
            total_paid = expected
            
        amt_each = round(total_paid / 5.0, 2)
        # Fix rounding drift in last payment
        remainder = round(total_paid - (amt_each * 4), 2)
        
        for k in range(5):
            val = amt_each if k < 4 else remainder
            p = Payment(
                payment_id=f"PM{payment_counter:05d}",
                contract_id=c.contract_id,
                content_id=c.content_id,
                amount_paid=max(0, val),
                payment_date=random_date(start_of_2023, datetime.now()).strftime("%Y-%m-%d")
            )
            db.add(p)
            payment_counter += 1
        
        if i % 200 == 0:
            db.commit()
    db.commit()

    # 4. PHASE 4: AUDIT TRIGGER
    print("--- 5. Initializing Global Audit ---")
    audit_service = AuditService()
    await audit_service.run_audit(db)
    db.commit()
    
    # 5. VERIFY
    res_under = db.query(AuditResult).filter(AuditResult.status == 'UNDERPAID').count()
    res_over = db.query(AuditResult).filter(AuditResult.status == 'OVERPAID').count()
    res_leakage = db.query(func.sum(func.abs(AuditResult.difference))).filter(AuditResult.status == 'UNDERPAID').scalar() or 0
    
    return {
        "contracts": 1000,
        "underpaid": res_under,
        "overpaid": res_over,
        "total_leakage": round(res_leakage, 2),
        "status": "success"
    }

if __name__ == "__main__":
    db = SessionLocal()
    res = asyncio.run(perform_dataset_reset(db))
    db.close()
    print(f"\nVerification: Under={res['underpaid']}, Over={res['overpaid']}, Leakage=₹{res['total_leakage']}")
