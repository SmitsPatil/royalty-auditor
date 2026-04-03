from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from reset_dataset import perform_dataset_reset
import logging

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.post("/reset-dataset")
async def reset_dataset(db: Session = Depends(get_db)):
    """
    DANGEROUS: Deletes all existing data and resets to 1000/5000/13000 baseline.
    Used for production calibration.
    """
    try:
        logging.info("Starting production dataset reset...")
        result = await perform_dataset_reset(db)
        return {
            "message": "Dataset Reset Successfully",
            "stats": result
        }
    except Exception as e:
        logging.error(f"Failed to reset dataset: {e}")
        raise HTTPException(status_code=500, detail=str(e))
