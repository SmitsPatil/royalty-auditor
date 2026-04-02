from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse, PlainTextResponse
from sqlalchemy.orm import Session
import csv
import io
from datetime import datetime

from app.db import get_db
from app.models.schema import Contract, AuditResult

router = APIRouter(prefix="/export", tags=["Exports"])

def format_date_str(val):
    """Helper to convert any date-like string or object to dd-mm-yyyy."""
    if not val:
        return ""
    try:
        # If it's already a datetime object
        if isinstance(val, datetime):
            return val.strftime("%d-%m-%Y")
        # If it's a string (likely from SQLite or ISO)
        str_val = str(val).split("T")[0] # handle ISO T separator
        dt = datetime.strptime(str_val, "%Y-%m-%d")
        return dt.strftime("%d-%m-%Y")
    except:
        return str(val)

@router.get("/contracts_text.txt", response_class=PlainTextResponse)
def export_contracts_text(db: Session = Depends(get_db)):
    contracts = db.query(Contract).all()
    lines = ["DIGITAL LICENSE EXPORT\n" + "="*40]
    for c in contracts:
        lines.append(f"Contract ID: {c.contract_id}")
        lines.append(f"Content: {c.content_id}")
        lines.append(f"Studio: {c.studio}")
        lines.append(f"Royalty Rate: {c.royalty_rate}%")
        lines.append(f"Rate per play: ${c.rate_per_play}")
        lines.append(f"Territory: {c.territory}")
        lines.append(f"Valid: {format_date_str(c.start_date)} to {format_date_str(c.end_date)}")
        lines.append(f"Tier: > {c.tier_threshold} @ ${c.tier_rate}")
        lines.append("-" * 40)
    
    return "\n".join(lines)


@router.get("/audit_results.csv")
def export_audit_results(db: Session = Depends(get_db)):
    results = db.query(AuditResult).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["Contract ID", "Content ID", "Studio", "Expected Payment", "Actual Paid", "Difference", "Status", "Violations", "Total Plays", "Timestamp"])
    
    for r in results:
        writer.writerow([
            r.contract_id, 
            r.content_id, 
            r.studio, 
            r.expected, 
            r.paid, 
            r.difference, 
            r.status, 
            r.violations, 
            r.total_plays, 
            format_date_str(r.timestamp)
        ])
    
    output.seek(0)
    headers = {"Content-Disposition": f"attachment; filename=audit_results_{datetime.now().strftime('%d_%m_%H%M')}.csv"}
    return StreamingResponse(io.StringIO(output.getvalue()), media_type="text/csv", headers=headers)


@router.get("/violations.csv")
def export_violations(db: Session = Depends(get_db)):
    results = db.query(AuditResult).filter(AuditResult.violations != "").all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["Contract ID", "Content ID", "Status", "Violations", "Difference", "Date"])
    
    for r in results:
        if r.violations and str(r.violations).strip() != "":
            writer.writerow([
                r.contract_id, 
                r.content_id, 
                r.status, 
                r.violations, 
                r.difference, 
                format_date_str(r.timestamp)
            ])
            
    output.seek(0)
    headers = {"Content-Disposition": f"attachment; filename=violations_{datetime.now().strftime('%d_%m_%H%M')}.csv"}
    return StreamingResponse(io.StringIO(output.getvalue()), media_type="text/csv", headers=headers)

@router.get("/config.json")
def export_config():
    return {
        "agents": ["PlannerAgent", "ContractReaderAgent", "UsageAgent", "RoyaltyAgent", "LedgerAgent", "AuditAgent", "ViolationAgent", "ReporterAgent"],
        "version": "1.1.0",
        "date_format": "dd-mm-yyyy"
    }
