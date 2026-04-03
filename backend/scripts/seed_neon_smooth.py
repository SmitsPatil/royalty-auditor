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

def seed_neon_smooth():
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
    
    # Target Daily Sums for the smooth trend (Sum = ₹2,450):
    # Day 0 (Today): ~700
    # Day 1: ~550
    # Day 2: ~420
    # Day 3: ~310
    # Day 4: ~220
    # Day 5: ~150
    # Day 6 (Oldest): ~100
    
    daily_targets = [700, 550, 420, 310, 220, 150, 100]
    # Total sum of targets = ₹2,450
    
    contracts = []
    logs = []
    payments = []
    audit_results = []
    
    now = datetime.now()
    
    # Prepare violation buckets for the 7 days
    violation_indices = list(range(CLEAN_COUNT + 1, TOTAL + 1))
    random.shuffle(violation_indices)
    
    # We'll split the 280 violations into 7 days:
    # 280 / 7 = 40 per day? 
    # But we want more weight on the recent days to hit the higher sums.
    # Dist: 70, 60, 50, 40, 30, 20, 10 = 280. Perfect.
    daily_counts = [70, 60, 50, 40, 30, 20, 10]
    
    print(f"Generating {TOTAL} contracts with smooth {len(daily_targets)}-day trend...")
    
    processed_violations = 0
    
    # Generate all records
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
        
        # Default clean
        status = "OK"
        diff = 0.0
        days_back = random.randint(7, 30) # Older for clean
        
        # Check if this index is a violation
        if i > CLEAN_COUNT:
            # We need to assign it to a day
            # Find which day this violation should belong to
            current_day_bucket = 0
            temp_count = 0
            for d_idx, d_count in enumerate(daily_counts):
                temp_count += d_count
                if (i - CLEAN_COUNT) <= temp_count:
                    current_day_bucket = d_idx
                    break
            
            days_back = current_day_bucket
            
            # Financial targets for the day
            target_sum = daily_targets[days_back]
            count_in_day = daily_counts[days_back]
            avg_diff = target_sum / count_in_day
            
            # Status
            if i <= CLEAN_COUNT + OVER_COUNT:
                status = "OVERPAID"
                diff = round(random.uniform(avg_diff * 0.8, avg_diff * 1.2), 2)
            else:
                status = "UNDERPAID"
                diff = -round(random.uniform(avg_diff * 0.8, avg_diff * 1.2), 2)
        
        paid = expected + diff
        ts = (now - timedelta(days=days_back, minutes=random.randint(0, 1440))).strftime("%Y-%m-%dT%H:%M:%SZ")
            
        # Add Log & Payment
        logs.append(Log(play_id=f"P{i:04}", content_id=content_id, contract_id=c_id, timestamp=ts, country=contract.territory, plays=plays))
        payments.append(Payment(payment_id=f"PM{i:04}", content_id=content_id, contract_id=c_id, amount_paid=paid, payment_date=ts[:10]))
        
        # Add Audit Result
        audit_results.append(AuditResult(
            contract_id=c_id, content_id=content_id, studio=studio, 
            expected=expected, paid=paid, difference=diff, status=status, 
            violations="Regional Overpayment" if status == "OVERPAID" else "Royalty Leakage" if status == "UNDERPAID" else "",
            total_plays=plays, timestamp=ts
        ))

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
    
    print("-" * 30)
    print(f"Neon Smooth Seeding Complete!")
    print(f"Clean: {CLEAN_COUNT} | Overpaid: {OVER_COUNT} | Underpaid: {UNDER_COUNT}")
    print(f"Overpaid Sum: ₹{over_sum:.2f} | Underpaid Sum: ₹{under_sum:.2f}")
    print(f"Trend (Today -> 7d back sums):")
    # Group locally for verification
    trend = {}
    for a in audit_results:
        day = a.timestamp[:10]
        trend[day] = trend.get(day, 0) + abs(a.difference)
    for day in sorted(trend.keys(), reverse=True)[:7]:
        print(f"  {day}: ₹{trend[day]:.2f}")
    print("-" * 30)
    db.close()

if __name__ == "__main__":
    seed_neon_smooth()
