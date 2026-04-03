import csv
import io
from sqlalchemy.orm import Session
from app.models.schema import Contract
from datetime import datetime

class ContractService:

    async def upload_contracts_csv(self, csv_content: str, db: Session):
        f = io.StringIO(csv_content)
        reader = csv.DictReader(f)
        
        count = 0
        for row in reader:
            contract_data = {
                "contract_id":    row.get("contract_id"),
                "content_id":     row.get("content_id"),
                "studio":         row.get("studio", "Unknown"),
                "royalty_rate":   float(row.get("royalty_rate", 0)),
                "rate_per_play":  float(row.get("rate_per_play", 0)),
                "tier_rate":      float(row.get("tier_rate", 0)),
                "tier_threshold": int(row.get("tier_threshold", 0)),
                "territory":      row.get("territory", "Unknown"),
                "start_date":     row.get("start_date"),
                "end_date":       row.get("end_date"),
                "is_deleted":     0
            }
            if not contract_data["contract_id"]: continue
            
            # Using merge ensures we update existing records (Neon/Postgres dataset compatibility)
            contract = Contract(**contract_data)
            db.merge(contract)
            count += 1

        db.commit()
        return {"status": "success", "count": count}

    async def upload_contracts_json(self, contracts_data: list[dict], db: Session):
        count = 0
        for row in contracts_data:
            contract_id = row.get("contract_id")
            if not contract_id: continue
            
            contract_data = {
                "contract_id":    contract_id,
                "content_id":     row.get("content_id", "CID-UNKNOWN"),
                "studio":         row.get("studio", "Unknown"),
                "royalty_rate":   float(row.get("royalty_rate", 0)),
                "rate_per_play":  float(row.get("rate_per_play", 0)),
                "tier_rate":      float(row.get("tier_rate", 0)),
                "tier_threshold": int(row.get("tier_threshold", 0)),
                "territory":      row.get("territory", "Global"),
                "start_date":     row.get("start_date", datetime.utcnow().strftime("%Y-%m-%d")),
                "end_date":       row.get("end_date", "2099-12-31"),
                "is_deleted":     0
            }
            # Using merge handles existing 'Neon' dataset IDs correctly
            contract = Contract(**contract_data)
            db.merge(contract)
            count += 1

        db.commit()
        return {"status": "success", "count": count}

    def get_all_active_contracts(self, db: Session):
        return db.query(Contract).filter(Contract.is_deleted == 0).all()

    def get_contract_by_content_id(self, db: Session, content_id: str):
        return db.query(Contract).filter(
            Contract.content_id == content_id, 
            Contract.is_deleted == 0
        ).first()
