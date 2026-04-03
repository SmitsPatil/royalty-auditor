import os
import random
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.models.schema import Base, Contract, Log, Payment, AuditResult

# Use the Neon URL from the user request
DATABASE_URL = "postgresql://neondb_owner:npg_9DqiwJCehv3H@ep-twilight-morning-am8zdxj4-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def seed_neon():
    db = SessionLocal()
    
    print("Dropping and recreating tables in Neon...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    studios = ['Studio Alpha', 'Studio Beta', 'Studio Gamma', 'Studio Delta']
    content_types = ['Movie', 'Song', 'Podcast', 'Audiobook', 'Series']
    territories = ['US', 'IN', 'UK', 'CA', 'DE', 'JP', 'BR', 'AU', 'FR']
    
    # Targets
    TOTAL = 1000
    CLEAN_COUNT = 720
    OVER_COUNT = 180
    UNDER_COUNT = 100
    
    OVER_TOTAL_TARGET = 1600.0
    UNDER_TOTAL_TARGET = 850.0
    
    contracts = []
    logs = []
    payments = []
    audit_results = []
    
    now = datetime.now()
    
    print(f"Generating {TOTAL} contracts and associated data...")
    
    for i in range(1, TOTAL + 1):
        c_id = f"C{i:04}"
        category = random.choice(content_types)
        content_id = f"{category}_{random.randint(100, 999)}"
        studio = random.choice(studios)
        
        # Base contract logic
        rate = 0.05
        plays = 100
        expected = rate * plays # 5.0
        
        start_date = (now - timedelta(days=365)).strftime("%Y-%m-%d")
        end_date = (now + timedelta(days=365)).strftime("%Y-%m-%d")
        
        contract = Contract(
            contract_id=c_id,
            content_id=content_id,
            studio=studio,
            rate_per_play=rate,
            tier_rate=0.08,
            tier_threshold=500,
            territory=random.choice(territories),
            start_date=start_date,
            end_date=end_date
        )
        contracts.append(contract)
        
        # Status assignment
        if i <= CLEAN_COUNT:
            status = "OK"
            diff = 0.0
            paid = expected
        elif i <= CLEAN_COUNT + OVER_COUNT:
            status = "OVERPAID"
            # Avg diff = 1600 / 180 = 8.88
            diff = round(random.uniform(5, 12), 2)
            paid = expected + diff
        else:
            status = "UNDERPAID"
            # Avg diff = 850 / 100 = 8.5
            diff = -round(random.uniform(5, 12), 2)
            paid = expected + diff
            
        # Add Log
        log = Log(
            play_id=f"P{i:04}",
            content_id=content_id,
            contract_id=c_id,
            timestamp=now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            country=contract.territory,
            plays=plays,
            user_type='premium',
            device='mobile'
        )
        logs.append(log)
        
        # Add Payment
        pmt = Payment(
            payment_id=f"PM{i:04}",
            content_id=content_id,
            contract_id=c_id,
            amount_paid=paid,
            payment_date=now.strftime("%Y-%m-%d")
        )
        payments.append(pmt)
        
        # Add Audit Result
        audit = AuditResult(
            contract_id=c_id,
            content_id=content_id,
            studio=studio,
            expected=expected,
            paid=paid,
            difference=diff,
            status=status,
            violations="Overpayment detected" if status == "OVERPAID" else "Royalty leakage" if status == "UNDERPAID" else "",
            total_plays=plays,
            timestamp=now.strftime("%Y-%m-%dT%H:%M:%SZ")
        )
        audit_results.append(audit)

    # Batch inserts
    print("Inserting data into Neon...")
    db.add_all(contracts)
    db.add_all(logs)
    db.add_all(payments)
    db.add_all(audit_results)
    
    db.commit()
    
    # Final check on sums
    over_sum = sum(a.difference for a in audit_results if a.status == "OVERPAID")
    under_sum = sum(abs(a.difference) for a in audit_results if a.status == "UNDERPAID")
    total_var = over_sum + under_sum
    
    print("-" * 30)
    print(f"Neon Seeding Complete!")
    print(f"Clean: {CLEAN_COUNT}")
    print(f"Overpaid: {OVER_COUNT} (Sum: ₹{over_sum:.2f})")
    print(f"Underpaid: {UNDER_COUNT} (Sum: ₹{under_sum:.2f})")
    print(f"Total Variance: ₹{total_var:.2f}")
    print("-" * 30)
    
    db.close()

if __name__ == "__main__":
    seed_neon()
