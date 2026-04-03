from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.schema import Contract, ContractVersion
from app.db import get_db
from app.services.contract_service import ContractService
from app.services.audit_service import AuditService
from pydantic import BaseModel
from datetime import datetime, timedelta
import json

router = APIRouter(prefix="/contracts", tags=["Contracts"])
contract_service = ContractService()
audit_service = AuditService()

class ContractUpdateParams(BaseModel):
    content_id: str = None
    studio: str = None
    rate_per_play: float = None
    tier_rate: float = None
    tier_threshold: int = None
    territory: str = None
    start_date: str = None
    end_date: str = None

class ContractCreateBatch(BaseModel):
    contracts: list[dict]

@router.post("/upload")
async def upload_contracts(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Existing CSV file upload (formData)."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")
    content = await file.read()
    return await contract_service.upload_contracts_csv(content.decode("utf-8"), db)

@router.post("/upload-batch")
async def upload_contracts_batch(payload: ContractCreateBatch, db: Session = Depends(get_db)):
    """New JSON batch upload (for PDF/frontend-parsed data)."""
    return await contract_service.upload_contracts_json(payload.contracts, db)

@router.get("")
async def get_contracts(q: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Return contracts stored in Neon/PostgreSQL with pagination and search."""
    try:
        query = db.query(Contract).filter(Contract.is_deleted == 0)
        if q:
            query = query.filter(
                or_(
                    Contract.contract_id.ilike(f"%{q}%"),
                    Contract.content_id.ilike(f"%{q}%"),
                    Contract.studio.ilike(f"%{q}%")
                )
            )
        total = query.count()
        rows = query.offset(skip).limit(limit).all()
        return {
            "total": total,
            "data": [
                {
                    "contract_id":    r.contract_id,
                    "content_id":     r.content_id,
                    "studio":         r.studio,
                    "royalty_rate":   r.royalty_rate,
                    "rate_per_play":  r.rate_per_play,
                    "tier_rate":      r.tier_rate,
                    "tier_threshold": r.tier_threshold,
                    "territory":      r.territory,
                    "start_date":     r.start_date,
                    "end_date":       r.end_date,
                }
                for r in rows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/removed")
async def get_removed_contracts(db: Session = Depends(get_db)):
    """Lazy clean up on fetch, then return remaining deleted contracts."""
    now_str = datetime.utcnow().isoformat()
    expired_rows = db.query(Contract).filter(Contract.is_deleted == 1, Contract.auto_expunge_at < now_str).all()
    for r in expired_rows:
        db.delete(r)
    if expired_rows:
        db.commit()

    rows = db.query(Contract).filter(Contract.is_deleted == 1).order_by(Contract.deleted_at.desc()).all()
    return [{
        "contract_id": r.contract_id, 
        "content_id": r.content_id, 
        "deleted_at": r.deleted_at, 
        "auto_expunge_at": r.auto_expunge_at, 
        "studio": r.studio
    } for r in rows]

@router.put("/{contract_id}")
async def update_contract(contract_id: str, updates: ContractUpdateParams, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.contract_id == contract_id, Contract.is_deleted == 0).first()
    if not contract:
        raise HTTPException(404, "Contract not found")
    
    old_data = {
        "content_id": contract.content_id, "studio": contract.studio,
        "rate_per_play": contract.rate_per_play, "tier_rate": contract.tier_rate,
        "tier_threshold": contract.tier_threshold, "territory": contract.territory,
        "start_date": contract.start_date, "end_date": contract.end_date
    }
    cv = ContractVersion(contract_id=contract_id, modified_at=datetime.utcnow().isoformat(), previous_data=json.dumps(old_data))
    db.add(cv)

    update_dict = updates.dict(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(contract, k, v)
        
    db.commit()
    await audit_service.run_audit(db)
    return {"status": "success"}

@router.delete("/{contract_id}")
async def remove_contract(contract_id: str, retention_days: int = 30, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.contract_id == contract_id).first()
    if not contract: raise HTTPException(404, "Contract not found")
    
    contract.is_deleted = 1
    contract.deleted_at = datetime.utcnow().isoformat()
    contract.auto_expunge_at = (datetime.utcnow() + timedelta(days=retention_days)).isoformat()
    db.commit()
    
    await audit_service.run_audit(db)
    return {"status": "removed"}

@router.post("/{contract_id}/restore")
async def restore_contract(contract_id: str, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.contract_id == contract_id).first()
    if not contract: raise HTTPException(404, "Contract not found")
    
    contract.is_deleted = 0
    contract.deleted_at = None
    contract.auto_expunge_at = None
    db.commit()
    
    await audit_service.run_audit(db)
    return {"status": "restored"}
