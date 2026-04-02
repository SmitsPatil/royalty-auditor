from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.schema import Log
from app.db import get_db
from app.services.log_service import LogService

router = APIRouter(prefix="/logs", tags=["Logs"])
log_service = LogService()

@router.post("/upload")
async def upload_logs(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")
    content = await file.read()
    return await log_service.upload_logs_csv(content.decode("utf-8"), db)

@router.get("")
async def get_logs(q: str = None, skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
    """Return play logs stored in SQLite with pagination and search."""
    try:
        query = db.query(Log)
        if q:
            query = query.filter(
                or_(
                    Log.content_id.ilike(f"%{q}%"),
                    Log.play_id.ilike(f"%{q}%"),
                    Log.contract_id.ilike(f"%{q}%")
                )
            )
        rows = query.offset(skip).limit(limit).all()
        return [
            {
                "play_id":    r.play_id,
                "content_id": r.content_id,
                "contract_id":r.contract_id,
                "timestamp":  r.timestamp,
                "country":    r.country,
                "plays":      r.plays,
                "user_type":  r.user_type,
                "device":     r.device,
            }
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
