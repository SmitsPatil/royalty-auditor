from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.db import get_db
import os

from app.routes import payments, audit, contracts, logs, analytics, violations, pdf_contract, exports, admin

IS_VERCEL = os.getenv("VERCEL") == "1"
app = FastAPI(
    title="Digital Licensing & Royalty Auditor", 
    root_path="/api" if IS_VERCEL else ""
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(contracts.router)
app.include_router(logs.router)
app.include_router(payments.router)
app.include_router(audit.router)
app.include_router(analytics.router)
app.include_router(violations.router)
app.include_router(pdf_contract.router)
app.include_router(exports.router)
app.include_router(admin.router)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "LRAC API", "version": "1.0.0"}

@app.get("/")
def root():
    return {"message": "Digital Licensing & Royalty Auditor API", "status": "running"}


@app.get("/test-db")
def test_db(db: Session = Depends(get_db)):
    try:
        # Try to count contracts as a simple connectivity test
        from app.models.schema import Contract
        count = db.query(Contract).count()
        return {"status": "Neon/PostgreSQL connected via SQLAlchemy working ✅", "contracts_count": count}
    except Exception as e:
        return {"error": str(e)}
