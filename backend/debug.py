import sys
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models.schema import Contract, Log

db = SessionLocal()
contracts = db.query(Contract).all()
contract_map = {}
for c in contracts:
    terr = {t.strip() for t in (c.territory or "").split(",") if t.strip()}
    contract_map[c.contract_id] = {
        "territory": terr,
        "start_date": c.start_date,
        "end_date": c.end_date,
    }

violation_rows = db.query(Log.contract_id, Log.plays, Log.country, Log.timestamp).limit(10).all()
for cid, plays, country, ts in violation_rows:
    cm = contract_map[cid]
    ts_str = str(ts)[:10]
    print(f"Log: ts={ts_str}, country={country}")
    print(f"Contract: start={cm['start_date']}, end={cm['end_date']}, terr={cm['territory']}")
    
    is_valid = True
    if cm["territory"] and country and country not in cm["territory"]:
         print("TERR VIOLATION")
         is_valid = False
    if ts:
        if cm["start_date"] and ts_str < str(cm["start_date"])[:10]:
             print(f"EXPIRY < : {ts_str} < {str(cm['start_date'])[:10]}")
             is_valid = False
        if cm["end_date"] and ts_str > str(cm["end_date"])[:10]:
             print(f"EXPIRY > : {ts_str} > {str(cm['end_date'])[:10]}")
             is_valid = False
    print("VALID?", is_valid)
