import csv
import io
from sqlalchemy.orm import Session
from app.models.schema import Contract
from datetime import datetime

class ContractService:

    async def upload_contracts_json(self, contracts_data: list[dict], db: Session):
        contracts_to_add = []
        for row in contracts_data:
            # Basic Mapping & Defaults (Ensuring required columns for Neon)
            contract_id = row.get("contract_id")
            if not contract_id: continue # Skip if no ID
            
            contract = {
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
            contracts_to_add.append(contract)

        if contracts_to_add:
            # Batch insertion to database
            db.bulk_insert_mappings(Contract, contracts_to_add)
            db.commit()

        return {"status": "success", "count": len(contracts_to_add)}

    def get_all_active_contracts(self, db: Session):
        return db.query(Contract).filter(Contract.is_deleted == 0).all()

    def get_contract_by_content_id(self, db: Session, content_id: str):
        return db.query(Contract).filter(
            Contract.content_id == content_id, 
            Contract.is_deleted == 0
        ).first()
