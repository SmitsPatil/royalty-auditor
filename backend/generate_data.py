import csv
import random
from datetime import datetime, timedelta

def random_date(start, end):
    return start + timedelta(days=random.randint(0, int((end - start).days)))

def generate_data():
    territories = ['US', 'IN', 'UK', 'CA', 'DE', 'JP', 'BR', 'AU', 'FR']
    studios = ['StudioA', 'StudioB', 'StudioC', 'StudioD']
    
    # 1. GENERATE CONTRACTS
    contracts = []
    contracts_dict = {}
    
    start_of_2023 = datetime(2023, 1, 1)
    start_of_2025 = datetime(2025, 1, 1)
    mid_of_2025 = datetime(2025, 6, 1)
    start_of_2027 = datetime(2027, 1, 1)

    # Generic Content Titles (per PRD)
    MOVIES = [f"Movie_{i}" for i in range(100, 500)]
    SONGS = [f"Song_{i}" for i in range(100, 500)]
    PODCASTS = [f"Podcast_{i}" for i in range(100, 500)]
    AUDIOBOOKS = [f"Audiobook_{i}" for i in range(100, 500)]
    SERIES = [f"Series_{i}" for i in range(100, 500)]

    print("Generating 1000 contracts...")
    for i in range(1, 1001):
        c_id = f"C{i}"
        start_date = random_date(start_of_2023, start_of_2025)
        end_date = random_date(mid_of_2025, start_of_2027)
        territory = random.choice(territories)
        
        category = random.choice(['Movie', 'Song', 'Podcast', 'Audiobook', 'Series'])
        if category == 'Movie': title = random.choice(MOVIES)
        elif category == 'Song': title = random.choice(SONGS)
        elif category == 'Podcast': title = random.choice(PODCASTS)
        elif category == 'Audiobook': title = random.choice(AUDIOBOOKS)
        else: title = random.choice(SERIES)

        c = {
            "contract_id": c_id,
            "content_id": title, # Use realistic title
            "studio": random.choice(studios),
            "rate_per_play": round(random.uniform(0.01, 0.05), 4),
            "tier_rate": round(random.uniform(0.05, 0.1), 4),
            "tier_threshold": random.randint(500, 5000),
            "territory": territory,
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d")
        }
        contracts.append(c)
        contracts_dict[c_id] = c

    with open("contracts_1000.csv", "w", newline='') as f:
        writer = csv.DictWriter(f, fieldnames=contracts[0].keys())
        writer.writeheader()
        writer.writerows(contracts)

    # 2. GENERATE STREAMING LOGS
    logs = []
    print("Generating 13,000 streaming logs...")
    
    # Track valid plays per contract
    valid_plays_per_contract = {c["contract_id"]: 0 for c in contracts}
    
    for i in range(1, 13001):
        c = random.choice(contracts)
        c_id = c["contract_id"]
        
        # Determine if this log has an error
        is_expiry_error = random.random() < 0.02
        is_territory_error = random.random() < 0.02
        
        start_dt = datetime.strptime(c["start_date"], "%Y-%m-%d")
        end_dt = datetime.strptime(c["end_date"], "%Y-%m-%d")
        
        if is_expiry_error:
            # log after end date
            log_date = random_date(end_dt + timedelta(days=1), start_of_2027 + timedelta(days=365))
        else:
            log_date = random_date(start_dt, end_dt)
            
        if is_territory_error:
            # pick a territory NOT in contract territory
            t_options = [t for t in territories if t != c["territory"]]
            log_territory = random.choice(t_options)
        else:
            log_territory = c["territory"]
            
        plays_count = random.randint(1, 1000)
        
        # If valid, add to tracker
        if not is_expiry_error and not is_territory_error:
            valid_plays_per_contract[c_id] += plays_count

        logs.append({
            "play_id": f"P{i}",
            "content_id": c["content_id"],
            "contract_id": c_id,
            "timestamp": log_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "country": log_territory,
            "plays": plays_count,
            "user_type": random.choice(['free', 'premium']),
            "device": random.choice(['mobile', 'web', 'tv'])
        })

    with open("streaming_logs_13k.csv", "w", newline='') as f:
        writer = csv.DictWriter(f, fieldnames=logs[0].keys())
        writer.writeheader()
        writer.writerows(logs)

    # 3. GENERATE PAYMENTS LEDGER
    payments = []
    print("Generating 5000 payments ledger...")
    
    payment_id_counter = 1
    
    for c in contracts:
        c_id = c["contract_id"]
        plays = valid_plays_per_contract[c_id]
        
        if plays < c["tier_threshold"]:
            expected = plays * c["rate_per_play"]
        else:
            expected = plays * c["tier_rate"]
            
        # Determine over/under payment status
        r = random.random()
        if r < 0.10: # Underpaid (10%)
            actual_paid = expected * 0.8
        elif r < 0.20: # Overpaid (10%)
            actual_paid = expected * 1.2
        else:   # Clean (80%)
            actual_paid = expected
            
        # Create payments (5 per contract to hit exactly 5,000)
        amount_per_payment = actual_paid / 5.0
        
        for _ in range(5):
            payments.append({
                "payment_id": f"PM{payment_id_counter}",
                "content_id": c["content_id"],
                "contract_id": c_id,
                "amount_paid": round(amount_per_payment, 2),
                "payment_date": random_date(start_of_2023, start_of_2027).strftime("%Y-%m-%d")
            })
            payment_id_counter += 1

    with open("payments_ledger.csv", "w", newline='') as f:
        writer = csv.DictWriter(f, fieldnames=payments[0].keys())
        writer.writeheader()
        writer.writerows(payments)
        
    print("Done! Generated:")
    print("- contracts_1000.csv")
    print("- streaming_logs_13k.csv")
    print("- payments_ledger.csv")

    # 4. GENERATE contracts_text.txt
    print("Generating contracts_text.txt (human-readable version)...")
    with open("contracts_text.txt", "w") as f:
        f.write("DIGITAL LICENSE EXPORT\n" + "="*40 + "\n")
        for i in range(min(50, len(contracts))): # First 50 for sample text
            c = contracts[i]
            f.write(f"Contract ID: {c['contract_id']}\n")
            f.write(f"Content: {c['content_id']}\n")
            f.write(f"Studio: {c['studio']}\n")
            f.write(f"Rate: ${c['rate_per_play']} per play\n")
            f.write(f"Territory: {c['territory']}\n")
            f.write(f"Valid from {c['start_date']} to {c['end_date']}\n")
            f.write("-" * 40 + "\n")
    print("- contracts_text.txt")

    # 5. GENERATE config.json
    import json
    config = {
        "agents": ["PlannerAgent", "ContractReaderAgent", "UsageAgent", "RoyaltyAgent", "LedgerAgent", "AuditAgent", "ViolationAgent", "ReporterAgent"],
        "version": "1.0.0",
        "demo_mode": True,
        "features_enabled": ["agentic_workflows", "royalty_leakage", "contract_ai"]
    }
    with open("config.json", "w") as f:
        json.dump(config, f, indent=4)
    print("- config.json")

if __name__ == "__main__":
    generate_data()
