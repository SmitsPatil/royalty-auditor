import csv
import io
from sqlalchemy.orm import Session
from app.models.schema import Log
from datetime import datetime

class LogService:

    async def upload_logs_csv(self, csv_content: str, db: Session):
        f = io.StringIO(csv_content)
        reader = csv.DictReader(f)
        
        logs_to_add = []
        for row in reader:
            # Standardize row keys and values
            log = {
                "play_id":    row.get("play_id") or f"P_{datetime.utcnow().timestamp()}_{row.get('content_id')}",
                "content_id": row.get("content_id"),
                "contract_id":row.get("contract_id"),
                "timestamp":  row.get("timestamp") or datetime.utcnow().isoformat(),
                "country":    row.get("country", "Unknown"),
                "plays":      int(row.get("plays", 0)),
                "user_type":  row.get("user_type", "Standard"),
                "device":     row.get("device", "Unknown")
            }
            logs_to_add.append(log)

        if logs_to_add:
            # Batch insert for speed
            db.bulk_insert_mappings(Log, logs_to_add)
            db.commit()

        return {"status": "success", "count": len(logs_to_add)}

    def get_logs_by_contract(self, db: Session, contract_id: str):
        return db.query(Log).filter(Log.contract_id == contract_id).all()
