from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.schema import Contract, Log, Payment, AuditResult
from datetime import datetime
import json

class AuditService:

    async def run_audit(self, db: Session, selected_agents=None, filters=None):
        trace = []
        
        def add_trace(agent, message, data=None):
            trace.append({"agent": agent, "message": message, "data": data, "timestamp": datetime.utcnow().isoformat()})

        # 1. Planner Agent
        add_trace("PlannerAgent", "Starting royalty audit pipeline", {"filters": filters})

        # 2. Contract Reader Agent
        contracts_query = db.query(Contract).filter(Contract.is_deleted == 0)
        
        # Handle flexible filters
        if filters:
            if filters.get("content_id"):
                contracts_query = contracts_query.filter(Contract.content_id == filters["content_id"])
            if filters.get("contract_id"):
                c_ids = filters["contract_id"]
                if isinstance(c_ids, str):
                    contracts_query = contracts_query.filter(Contract.contract_id == c_ids)
                elif isinstance(c_ids, list):
                    contracts_query = contracts_query.filter(Contract.contract_id.in_(c_ids))
        
        contracts = contracts_query.all()
        add_trace("ContractReaderAgent", f"Loaded {len(contracts)} active contracts", [c.contract_id for c in contracts])

        # Clear previous results if full run
        if not filters:
            db.query(AuditResult).delete()
            db.commit()

        summary = {
            "total_contracts": len(contracts),
            "violations_count": 0,
            "leakage_sum": 0,
            "overpaid_sum": 0,
            "ok_count": 0,
            "anomalies": []
        }

        for contract in contracts:
            # 3. Usage Agent
            usage_query = db.query(func.sum(Log.plays)).filter(Log.contract_id == contract.contract_id)
            
            # Territory filtering
            if contract.territory and contract.territory != "Unknown":
                allowed_territories = [t.strip().upper() for t in contract.territory.split(",")]
                usage_query = usage_query.filter(func.upper(Log.country).in_(allowed_territories))
            
            # Date range filtering
            if contract.start_date:
                usage_query = usage_query.filter(Log.timestamp >= contract.start_date)
            if contract.end_date:
                usage_query = usage_query.filter(Log.timestamp <= contract.end_date)

            total_plays = usage_query.scalar() or 0
            add_trace("UsageAgent", f"Calculated usage for {contract.contract_id}", {"plays": total_plays})

            # 4. Royalty Calculation Agent
            expected_royalty = 0
            if total_plays > 0:
                # Tiered calculation
                if contract.tier_threshold > 0 and total_plays > contract.tier_threshold:
                    base_plays = contract.tier_threshold
                    tier_plays = total_plays - base_plays
                    expected_royalty = (base_plays * contract.rate_per_play) + (tier_plays * contract.tier_rate)
                else:
                    expected_royalty = total_plays * contract.rate_per_play
            
            add_trace("RoyaltyAgent", f"Calculated expected royalty for {contract.contract_id}", {"expected": expected_royalty})

            # 5. Ledger Agent
            paid_amount = db.query(func.sum(Payment.amount_paid)).filter(Payment.contract_id == contract.contract_id).scalar() or 0
            add_trace("LedgerAgent", f"Retrieved payment records for {contract.contract_id}", {"paid": paid_amount})

            # 6. Audit & Violation Agents
            expected_royalty = round(expected_royalty, 2)
            difference = round(paid_amount - expected_royalty, 2)
            status = "OK"
            violations = []

            if difference < -0.01:
                status = "UNDERPAID"
                violations.append(f"Underpayment detected: ${abs(difference)}")
                summary["leakage_sum"] += abs(difference)
            elif difference > 0.01:
                status = "OVERPAID"
                violations.append(f"Overpayment detected: ${difference}")
                summary["overpaid_sum"] += difference
            else:
                summary["ok_count"] += 1

            # Check for territory mismatch in logs (Violation Agent)
            if contract.territory and contract.territory not in ["Unknown", "Global"]:
                allowed = [t.strip().upper() for t in contract.territory.split(",")]
                illegal_plays = db.query(Log).filter(Log.contract_id == contract.contract_id, func.upper(Log.country).notin_(allowed)).count()
                if illegal_plays > 0:
                    violations.append(f"Territory mismatch: {illegal_plays} plays outside {contract.territory}")

            add_trace("AuditAgent", f"Audit completed for {contract.contract_id}", {"status": status, "diff": difference})
            if violations:
                summary["violations_count"] += len(violations)
                add_trace("ViolationAgent", f"Detected {len(violations)} violations", {"details": violations})

            # Anomaly tracking
            if status != "OK" or violations:
                summary["anomalies"].append({
                    "contract_id": contract.contract_id,
                    "content_id": contract.content_id,
                    "status": status,
                    "difference": difference,
                    "violations": len(violations)
                })

            # 7. Reporter Agent (Save Result)
            res = AuditResult(
                contract_id=contract.contract_id,
                content_id=contract.content_id,
                studio=contract.studio,
                expected=expected_royalty,
                paid=paid_amount,
                difference=difference,
                status=status,
                violations="|".join(violations),
                total_plays=total_plays,
                timestamp=datetime.utcnow().isoformat()
            )
            db.merge(res)
            add_trace("ReporterAgent", f"Saved audit report for {contract.contract_id}")

        # Final Success Rate
        summary["success_rate"] = round((summary["ok_count"] / summary["total_contracts"]) * 100, 1) if summary["total_contracts"] > 0 else 100
        summary["anomalies"] = sorted(summary["anomalies"], key=lambda x: abs(x["difference"]), reverse=True)[:5]

        db.commit()
        
        # Filter trace by selected agents if requested
        if selected_agents:
            trace = [t for t in trace if t["agent"] in selected_agents]

        return {"status": "success", "trace": trace, "summary": summary}
