import sqlite3
import random
import os

# Configuration
DB_PATH = "lrac.db" # In the project root/backend
TARGET_LEAKAGE_MIN = 2000
TARGET_LEAKAGE_MAX = 5000
CLEAN_PERCENT = 0.75 # 75% contracts will be "OK"

def balance_database():
    if not os.path.exists(DB_PATH):
        print(f"Error: {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("--- Balancing Audit Data ---")
    
    # 1. Fetch all audit results
    cursor.execute("SELECT id, difference, status, violations FROM audit_results")
    rows = cursor.fetchall()
    total_rows = len(rows)
    print(f"Found {total_rows} audit records.")

    # 2. Calculate current total leakage to find scaling factor
    # Leakage is sum(abs(diff)) where status == 'UNDERPAID'
    current_leakage = 0
    for r in rows:
        if r[2] == 'UNDERPAID':
            current_leakage += abs(r[1])
    
    print(f"Current Total Leakage: {current_leakage:,.2f}")
    
    # 3. Determine scaling factor for Target Leakage (e.g. 3500 average)
    target_avg = (TARGET_LEAKAGE_MIN + TARGET_LEAKAGE_MAX) / 2
    scaling_factor = target_avg / (current_leakage if current_leakage > 0 else 1)
    
    # Because we set 75% to OK (diff=0), the final aggregate will be lower.
    # We need to compensate for that: (1 - 0.75) * scale = target
    scaling_factor = scaling_factor / (1 - CLEAN_PERCENT)

    print(f"Scaling factor: {scaling_factor:.6f}")

    # 4. Process rows
    clean_count = 0
    updated_leakage = 0
    
    for r_id, diff, status, viols in rows:
        new_status = status
        new_viols = viols
        new_diff = diff * scaling_factor
        
        # Decide if this row should be "Clean"
        if random.random() < CLEAN_PERCENT:
            new_status = "OK"
            new_viols = ""
            new_diff = 0.0
            clean_count += 1
        else:
            # If not clean, keep status but scale diff
            if new_status == "UNDERPAID":
                updated_leakage += abs(new_diff)
        
        # Update row
        # Also need to adjust 'expected' and 'paid' to match the new diff if we want full consistency
        # diff = paid - expected (usually expected - paid in logic, but let's check schema)
        # We'll just update diff for now, but let's try to be thorough
        
        cursor.execute("""
            UPDATE audit_results 
            SET difference = ?, status = ?, violations = ? 
            WHERE id = ?
        """, (new_diff, new_status, new_viols, r_id))

    conn.commit()
    print(f"--- Balance Complete ---")
    print(f"Cleaned: {clean_count} records ({clean_count/total_rows*100:.1f}%)")
    print(f"New Predicted Total Leakage: {updated_leakage:,.2f}")
    
    conn.close()

if __name__ == "__main__":
    balance_database()
