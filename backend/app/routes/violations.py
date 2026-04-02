from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models.schema import AuditResult
from app.db import get_db

router = APIRouter(prefix="/violations", tags=["Violations"])

@router.get("")
async def get_violations(db: Session = Depends(get_db)):
    """
    Returns all audit results from SQLite that have one or more violations,
    enriched with a classified `violation_types` list.
    """
    try:
        rows = db.query(AuditResult).filter(AuditResult.violations != "").all()
        result = []

        for r in rows:
            violation_msgs = [v.strip() for v in (r.violations or "").split("|") if v.strip()]
            if not violation_msgs:
                continue

            types = set()
            for msg in violation_msgs:
                m = msg.lower()
                if "territory"    in m: types.add("territory")
                if "expiry"       in m: types.add("expiry")
                if "overpayment"  in m: types.add("overpayment")
                if "underpayment" in m: types.add("underpayment")
                if "missing"      in m: types.add("missing_payment")

            result.append({
                "contract_id":     r.contract_id,
                "content_id":      r.content_id,
                "studio":          r.studio,
                "status":          r.status,
                "expected":        r.expected,
                "paid":            r.paid,
                "difference":      r.difference,
                "violations":      violation_msgs,
                "violation_types": sorted(types),
                "timestamp":       r.timestamp,
            })

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/summary")
async def get_violations_summary(db: Session = Depends(get_db)):
    """Violation counts grouped by type from SQLite — for the doughnut chart."""
    try:
        rows = db.query(AuditResult).all()
        counts = {
            "territory":       0,
            "expiry":          0,
            "overpayment":     0,
            "underpayment":    0,
            "missing_payment": 0,
        }
        for r in rows:
            for msg in (r.violations or "").split("|"):
                m = msg.strip().lower()
                if "territory"    in m: counts["territory"]       += 1
                if "expiry"       in m: counts["expiry"]          += 1
                if "overpayment"  in m: counts["overpayment"]     += 1
                if "underpayment" in m: counts["underpayment"]    += 1
                if "missing"      in m: counts["missing_payment"] += 1
        return counts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
