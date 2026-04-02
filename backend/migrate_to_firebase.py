import sqlite3
import firebase_admin
from firebase_admin import credentials, firestore
import os
import json

# Setup Firebase
cred_path = "./firebase.json"
if not os.path.exists(cred_path):
    print(f"Error: {cred_path} not found. Please ensure it exists in the backend directory.")
    exit(1)

cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

# Connect to SQLite
sqlite_path = "./lrac.db"
if not os.path.exists(sqlite_path):
    print(f"Error: {sqlite_path} not found. No local data to migrate.")
    exit(1)

conn = sqlite3.connect(sqlite_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

def migrate_table(table_name, collection_name, id_field=None):
    # Check current count in Firestore (to resume)
    print(f"Checking existing count in Firestore for {collection_name}...")
    existing_count = db.collection(collection_name).count().get()[0][0].value
    print(f"Found {existing_count} existing records. Resuming from offset {existing_count}...")

    print(f"Migrating {table_name} to {collection_name} (Resuming)...")
    # Use OFFSET to skip what's already there
    cursor.execute(f"SELECT * FROM {table_name} LIMIT -1 OFFSET {existing_count}")
    rows = cursor.fetchall()
    
    if not rows:
        print(f"No new records to migrate for {table_name}.\n")
        return

    col_ref = db.collection(collection_name)
    
    # Firestore batch limit is 500
    batch = db.batch()
    count = 0
    total = existing_count
    
    for row in rows:
        data = dict(row)
        # Use existing ID if possible, otherwise auto-ID
        if id_field and data.get(id_field):
            doc_ref = col_ref.document(str(data[id_field]))
        else:
            doc_ref = col_ref.document()
            
        batch.set(doc_ref, data)
        count += 1
        total += 1
        
        if count >= 500:
            batch.commit()
            print(f"  Committed 500 records (Total in Firestore: {total})...")
            batch = db.batch()
            count = 0
            
    if count > 0:
        batch.commit()
        print(f"  Committed remaining {count} records (Total in Firestore: {total}).")
    
    print(f"Done migrating {table_name}.\n")

try:
    # Migrate each core table - Prioritizing Contracts and Payments over Logs
    migrate_table("contracts", "contracts", "contract_id")
    migrate_table("payments", "payments", "payment_id")
    migrate_table("logs", "logs", "play_id")
    migrate_table("audit_results", "audit_results") 
    
    print("Migration step complete! ✅")
    print("You can now safely deploy to Vercel.")
except Exception as e:
    if "Quota exceeded" in str(e) or "429" in str(e):
        print(f"\n⚠️ Daily quota reached again! Current Firestore state is saved.")
        print(f"Please run this script again in 24 hours to migrate the next batch.")
    else:
        print(f"An error occurred during migration: {e}")
finally:
    conn.close()
