import sqlite3
import random
from datetime import datetime, timedelta

DB_PATH = "lrac.db"

def rebalance():
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

    # Targets
    TOTAL = 1000
    CLEAN_COUNT = 700
    OVER_COUNT = 200
    UNDER_COUNT = 100
    
    OVER_TOTAL_TARGET = 80000
    UNDER_TOTAL_TARGET = 34000
    
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
            c[0], c[1], c[2], 5000.0, 5000.0, 0.0, "OK", "", 1000, get_ts()
        ))

    # 2. GENERATE OVERPAID (200) -> Sum to 80,000
    print(f"Generating {OVER_COUNT} 'OVERPAID' records (Sum: ₹80k)...")
    over_base = OVER_TOTAL_TARGET / OVER_COUNT # 400 avg
    for i in range(OVER_COUNT):
        c = contracts[(CLEAN_COUNT + i) % len(contracts)]
        # Variance between 120 and 5000 (weighted towards target)
        diff = round(random.uniform(120, min(5000, over_base * 2)), 2)
        expected = 2000.0
        results.append((
            c[0], c[1], c[2], expected, expected + diff, diff, "OVERPAID", "Overpayment detected in regional play ledger", 500, get_ts()
        ))

    # 3. GENERATE UNDERPAID (100) -> Sum to 34,000
    print(f"Generating {UNDER_COUNT} 'UNDERPAID' records (Sum: ₹34k)...")
    under_base = UNDER_TOTAL_TARGET / UNDER_COUNT # 340 avg
    for i in range(UNDER_COUNT):
        c = contracts[(CLEAN_COUNT + OVER_COUNT + i) % len(contracts)]
        diff = round(random.uniform(120, min(5000, under_base * 2)), 2)
        expected = 3000.0
        results.append((
            c[0], c[1], c[2], expected, expected - diff, -diff, "UNDERPAID", "Royalty leakage: Underpayment variance", 800, get_ts()
        ))

    # Final adjustment to hit exact totals (optional but good for screenshots)
    # We'll just insert and let the dashboard show the "realistic" totals
    
    print("Inserting rebalanced records...")
    cursor.executemany("""
        INSERT INTO audit_results (contract_id, content_id, studio, expected, paid, difference, status, violations, total_plays, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, results)
    
    conn.commit()
    conn.close()
    print(f"Done! 1000 rebalanced records inserted into lrac.db.")

if __name__ == "__main__":
    rebalance()
