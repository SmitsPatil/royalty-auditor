from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.schema import Payment
from app.db import get_db
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["Payments"])
payment_service = PaymentService()

@router.post("/upload")
async def upload_payments(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    content = await file.read()
    try:
        return await payment_service.upload_payments_csv(content.decode("utf-8"), db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
async def get_payments(q: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Return payments stored in SQLite with pagination and search."""
    try:
        query = db.query(Payment)
        if q:
            query = query.filter(
                or_(
                    Payment.payment_id.ilike(f"%{q}%"),
                    Payment.content_id.ilike(f"%{q}%"),
                    Payment.contract_id.ilike(f"%{q}%")
                )
            )
        total = query.count()
        rows = query.offset(skip).limit(limit).all()
        return {
            "total": total,
            "data": [
                {
                    "payment_id":   r.payment_id,
                    "content_id":   r.content_id,
                    "contract_id":  r.contract_id,
                    "amount_paid":  r.amount_paid,
                    "payment_date": r.payment_date,
                }
                for r in rows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
