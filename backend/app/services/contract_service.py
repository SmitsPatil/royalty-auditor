import csv
import io
from sqlalchemy.orm import Session
from app.models.schema import Contract
from datetime import datetime

class ContractService:

    async def upload_contracts_csv(self, csv_content: str, db: Session):
        f = io.StringIO(csv_content)
        reader = csv.DictReader(f)
        
        contracts_to_add = []
        for row in reader:
            contract = {
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
            contracts_to_add.append(contract)

        if contracts_to_add:
            # Use bulk_insert_mappings for SQLite speed
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
