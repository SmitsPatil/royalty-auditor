import sqlite3
import random
import uuid
from datetime import datetime, timedelta

DB_PATH = "lrac.db"

CATEGORIES = ["Podcast", "Song", "Movie", "Series", "Audiobook"]
STUDIOS   = ["Paramount", "Warner Bros", "Universal", "Spotify Premium", "Audible Originals"]
TERRITORIES = ["US", "CA", "UK,FR,DE", "IN,SG", "Global"]

# TARGETS
TARGET_LEAKAGE_MIN = 3000
TARGET_LEAKAGE_MAX = 4000

def clear_db(cursor):
    cursor.execute("DELETE FROM contracts")
    cursor.execute("DELETE FROM logs")
    cursor.execute("DELETE FROM payments")
    cursor.execute("DELETE FROM audit_results")
    cursor.execute("DELETE FROM contract_versions")

def seed():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("--- Clearing existing data ---")
    clear_db(cursor)

    print("--- Generating 1,000 Contracts ---")
    contracts_data = [] 
    for i in range(1000):
        cat = random.choice(CATEGORIES)
        c_id = f"CON-{i+1000:04d}"
        content_id = f"{cat}_{uuid.uuid4().hex[:6].upper()}"
        studio = random.choice(STUDIOS)
        terr = random.choice(TERRITORIES)
        
        # Consistent rates
        rate_per_play = round(random.uniform(0.01, 0.05), 4)
        tier_rate = round(rate_per_play * 1.2, 4)
        threshold = random.choice([0, 5000, 10000])
        
        cursor.execute("""
            INSERT INTO contracts (contract_id, content_id, studio, royalty_rate, rate_per_play, tier_rate, tier_threshold, territory, start_date, end_date, is_deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (c_id, content_id, studio, 15.0, rate_per_play, tier_rate, threshold, terr, "2024-01-01", "2025-12-31", 0))
        contracts_data.append({"id": c_id, "content": content_id, "rate": rate_per_play, "t_rate": tier_rate, "thresh": threshold, "terr": terr})

    print("--- Generating 50,000 Streaming Logs ---")
    logs = []
    for _ in range(50000):
        c = random.choice(contracts_data)
        c_id = c["id"]
        content_id = c["content"]
        terr_str = c["terr"]
        
        # STRICT territory matching for EVERY log
        if terr_str == "Global":
            country = random.choice(["US", "CA", "UK", "FR", "DE", "IN", "SG", "JP"])
        else:
            country = random.choice(terr_str.split(","))
        
        play_id = f"PLY-{uuid.uuid4().hex.upper()}"
        plays = random.randint(1, 50)
        date = (datetime(2024, 1, 1) + timedelta(days=random.randint(0, 365))).isoformat()
        logs.append((play_id, content_id, c_id, date, country, plays, "Premium", "Mobile"))
    
    cursor.executemany("INSERT INTO logs (play_id, content_id, contract_id, timestamp, country, plays, user_type, device) VALUES (?,?,?,?,?,?,?,?)", logs)

    print("--- Generating 10,000 Payments (800 OK, 200 Flagged) ---")
    payments = []
    cursor.execute("SELECT contract_id, SUM(plays) FROM logs GROUP BY contract_id")
    usage_map = dict(cursor.fetchall())
    
    # We want EXACTLY 800 OK results.
    # To do this, we ensure no noise for 800, and exactly controlled noise for 200.
    flagged_indices = random.sample(range(1000), 200) # 20% Flagged = 200
    
    for i in range(1000):
        c = contracts_data[i]
        c_id = c["id"]
        content_id = c["content"]
        rate = c["rate"]
        t_rate = c["t_rate"]
        thresh = c["thresh"]
        
        plays = usage_map.get(c_id, 0)
        
        # Calculate expected using EXACT same logic as AuditService
        if thresh > 0 and plays > thresh:
            expected = (thresh * rate) + ((plays - thresh) * t_rate)
        else:
            expected = plays * rate
            
        expected = round(expected, 2)
        
        is_flagged = i in flagged_indices
        paid = expected
        
        if is_flagged:
            avg_leak = (TARGET_LEAKAGE_MIN + TARGET_LEAKAGE_MAX) / (2 * len(flagged_indices))
            noise = round(random.uniform(avg_leak * 0.5, avg_leak * 1.5), 2)
            if random.random() > 0.5: # 50/50 Under/Over
                paid = round(expected - noise, 2)
            else:
                paid = round(expected + noise, 2)
        
        # Divide into exactly 10 payments
        per_payment = round(paid / 10, 4)
        total_pushed = 0
        for p_idx in range(10):
            p_id = f"PAY-{uuid.uuid4().hex.upper()}"
            p_date = (datetime(2024, 1, 1) + timedelta(days=random.randint(0, 365))).isoformat()
            
            amt = per_payment
            if p_idx == 9: # Precision catch
                amt = round(paid - total_pushed, 4)
            
            payments.append((p_id, content_id, c_id, amt, p_date))
            total_pushed = round(total_pushed + amt, 4)

    cursor.executemany("INSERT INTO payments (payment_id, content_id, contract_id, amount_paid, payment_date) VALUES (?,?,?,?,?)", payments)

    conn.commit()
    conn.close()
    print("--- Seed Complete ---")

if __name__ == "__main__":
    seed()
