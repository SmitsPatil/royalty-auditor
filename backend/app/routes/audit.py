from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.models.schema import AuditResult, Contract, Payment
from app.db import get_db
from app.services.audit_service import AuditService
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/audit", tags=["Audit"])
audit_service = AuditService()

class AuditRunParams(BaseModel):
    agents: Optional[List[str]] = None
    filters: Optional[dict] = None

@router.post("/run")
async def run_audit(params: AuditRunParams = None, db: Session = Depends(get_db)):
    try:
        agents = params.agents if params else None
        filters = params.filters if params else None
        return await audit_service.run_audit(db, agents, filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AuditStepParams(BaseModel):
    agent_name: str
    filters: Optional[dict] = None

@router.post("/run-step")
async def run_audit_step(params: AuditStepParams, db: Session = Depends(get_db)):
    """Runs a single agent step from SQLite and returns only that agent's trace contribution."""
    try:
        # Full audit logic with single agent selected
        res = await audit_service.run_audit(db, [params.agent_name], params.filters)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/results")
async def get_audit_results(q: str = None, category: str = None, skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
    """Return stored audit results from SQLite with pagination and search."""
    try:
        query = db.query(AuditResult)
        if category:
            query = query.filter(AuditResult.content_id.ilike(f"{category}%"))
        
        if q:
            query = query.filter(
                or_(
                    AuditResult.content_id.ilike(f"%{q}%"),
                    AuditResult.contract_id.ilike(f"%{q}%"),
                    AuditResult.studio.ilike(f"%{q}%")
                )
            )
        total = query.count()
        rows = query.offset(skip).limit(limit).all()
        return {
            "total": total,
            "data": [
                {
                    "id":           r.id,
                    "contract_id":  r.contract_id,
                    "content_id":   r.content_id,
                    "studio":       r.studio,
                    "expected":     r.expected,
                    "paid":         r.paid,
                    "difference":   r.difference,
                    "status":       r.status,
                    "violations":   r.violations.split(" | ") if r.violations else [],
                    "total_plays":  r.total_plays,
                    "timestamp":    r.timestamp,
                }
                for r in rows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
