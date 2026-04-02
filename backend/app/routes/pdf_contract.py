from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session
from app.services.pdf_service import PDFService
from app.db import get_db

router = APIRouter(prefix="/pdf", tags=["PDF"])

pdf_service = PDFService()

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    return await pdf_service.process_pdf(file, db)
