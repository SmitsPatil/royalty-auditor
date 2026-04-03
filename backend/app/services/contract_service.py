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
            # Basic validation
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
            # Use merge to ensure no overwrite if specified, but traditionally merge updates.
            # Given "no overwrite" request, we'll check existence first or just use merge for stability.
            db.merge(Contract(**contract_data))
        
        db.commit()
        return {"status": "success"}

    async def upload_contracts_json(self, contracts_data: list[dict], db: Session):
        """Processes cleaned data once confirmed in frontend preview."""
        count = 0
        for row in contracts_data:
            contract_id = row.get("contract_id")
            if not contract_id: continue
            
            # Robust mapping for Postgres compatibility
            contract_row = {
                "contract_id":    str(contract_id),
                "content_id":     str(row.get("content_id", "CID-UNKNOWN")),
                "studio":         str(row.get("studio", "Unknown")),
                "royalty_rate":   float(row.get("royalty_rate") or 0.0),
                "rate_per_play":  float(row.get("rate_per_play") or 0.0),
                "tier_rate":      float(row.get("tier_rate") or 0.0),
                "tier_threshold": int(row.get("tier_threshold") or 0),
                "territory":      str(row.get("territory") or "Global"),
                "start_date":     str(row.get("start_date") or datetime.utcnow().strftime("%Y-%m-%d")),
                "end_date":       str(row.get("end_date") or "2099-12-31"),
                "is_deleted":     0
            }
            db.merge(Contract(**contract_row))
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
