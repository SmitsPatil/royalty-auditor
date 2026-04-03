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

class QueryRequest(BaseModel):
    query: str

@router.post("/query")
async def run_ai_query(request: QueryRequest, db: Session = Depends(get_db)):
    """
    Executes a natural language audit query and returns a data-driven answer.
    """
    try:
        if not request.query:
            raise HTTPException(status_code=400, detail="Query cannot be empty")
        return await analytics_service.query(db, request.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
