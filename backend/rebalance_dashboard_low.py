import sqlite3
import random
from datetime import datetime, timedelta

DB_PATH = "lrac.db"

def rebalance_low_variance():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Cleaning existing audit results...")
    cursor.execute("DELETE FROM audit_results")
    
    print("Fetching active contracts...")
    cursor.execute("SELECT contract_id, content_id, studio FROM contracts LIMIT 1000")
    contracts = cursor.fetchall()
    
    if not contracts:
        print("No contracts found! Run reseed_db.py first.")
        return

    # Targets (Reduced Scale)
    TOTAL = 1000
    CLEAN_COUNT = 700
    OVER_COUNT = 200
    UNDER_COUNT = 100
    
    # Financial Targets
    OVER_TOTAL_TARGET = 1600.0  # ~1600
    UNDER_TOTAL_TARGET = 850.0  # ~850
    # Total Variance should be ~2450
    
    results = []
    now = datetime.now()

    # Helper to get random timestamp in last 7 days
    def get_ts():
        days_back = random.randint(0, 6)
        minutes_back = random.randint(0, 1440)
        ts = now - timedelta(days=days_back, minutes=minutes_back)
        return ts.strftime("%Y-%m-%dT%H:%M:%SZ")

    # 1. GENERATE CLEAN (700)
    print(f"Generating {CLEAN_COUNT} balanced 'OK' records...")
    for i in range(CLEAN_COUNT):
        c = contracts[i % len(contracts)]
        results.append((
            c[0], c[1], c[2], 500.0, 500.0, 0.0, "OK", "", 100, get_ts()
        ))

    # 2. GENERATE OVERPAID (200) -> Sum to ~1600
    print(f"Generating {OVER_COUNT} 'OVERPAID' records (Sum: ₹1,600)...")
    over_base = OVER_TOTAL_TARGET / OVER_COUNT # 8.0 avg per record
    for i in range(OVER_COUNT):
        c = contracts[(CLEAN_COUNT + i) % len(contracts)]
        # Variance between 2 and 15 (weighted towards 8)
        diff = round(random.uniform(2, 14), 2)
        expected = 200.0
        results.append((
            c[0], c[1], c[2], expected, expected + diff, diff, "OVERPAID", "Minor overpayment variance in regional play", 10, get_ts()
        ))

    # 3. GENERATE UNDERPAID (100) -> Sum to ~850
    print(f"Generating {UNDER_COUNT} 'UNDERPAID' records (Sum: ₹850)...")
    under_base = UNDER_TOTAL_TARGET / UNDER_COUNT # 8.5 avg per record
    for i in range(UNDER_COUNT):
        c = contracts[(CLEAN_COUNT + OVER_COUNT + i) % len(contracts)]
        # Variance between 2 and 15
        diff = round(random.uniform(2, 14), 2)
        expected = 300.0
        results.append((
            c[0], c[1], c[2], expected, expected - diff, -diff, "UNDERPAID", "Slight royalty leakage detected", 15, get_ts()
        ))

    print("Inserting low-variance rebalanced records...")
    cursor.executemany("""
        INSERT INTO audit_results (contract_id, content_id, studio, expected, paid, difference, status, violations, total_plays, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, results)
    
    conn.commit()
    conn.close()
    print(f"Done! 1000 records inserted. Total Variance scaled to ~₹2,450.")

if __name__ == "__main__":
    rebalance_low_variance()
