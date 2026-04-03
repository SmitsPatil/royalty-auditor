from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.services.analytics_service import AnalyticsService
from app.db import get_db

router = APIRouter(prefix="/analytics", tags=["Analytics"])
analytics_service = AnalyticsService()

@router.get("/summary")
async def get_analytics_summary(category: str = None, db: Session = Depends(get_db)):
    """
    Returns aggregated chart data from SQLite audit results:
    - overpaid / underpaid counts
    - leakage by content and studio
    - violation keyword counts
    """
    try:
        return await analytics_service.get_summary(db, category)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
