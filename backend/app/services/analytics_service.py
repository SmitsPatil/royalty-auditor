from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.models.schema import AuditResult, Contract
from datetime import datetime, timedelta

class AnalyticsService:

    async def get_summary(self, db: Session, category: str = None):
        """
        Aggregate audit results using SQL-level aggregation (SUM, COUNT, GROUP BY).
        Optimized for Neon PostgreSQL, as requested.
        """
        # Base query joined with Contract
        base_query = db.query(AuditResult).join(Contract, AuditResult.contract_id == Contract.contract_id)
        if category:
            base_query = base_query.filter(AuditResult.content_id.ilike(f"{category}%"))
        
        # 1. KPI Counts & Totals
        # Total Population from Contract table
        total_contracts = db.query(Contract).count()

        # Audited Stats: Use a subquery to pick only the LATEST result per contact to avoid counting duplicates
        latest_ids_sub = db.query(
            AuditResult.contract_id,
            func.max(AuditResult.id).label("latest_id")
        ).group_by(AuditResult.contract_id).subquery()

        status_stats = db.query(
            AuditResult.status,
            func.count(AuditResult.id).label("count"),
            func.sum(func.abs(AuditResult.difference)).label("sum_diff")
        ).join(latest_ids_sub, AuditResult.id == latest_ids_sub.c.latest_id)\
         .join(Contract, AuditResult.contract_id == Contract.contract_id)\
         .filter(Contract.is_deleted == 0)\
         .group_by(AuditResult.status).all()

        stats_map = {s.status: {"count": s.count, "sum_diff": float(s.sum_diff or 0)} for s in status_stats}
        
        # Explicit status mapping to ensure no stale mocks appear
        clean_count = stats_map.get("OK", {}).get("count", 0)
        overpaid_count = stats_map.get("OVERPAID", {}).get("count", 0)
        underpaid_count = stats_map.get("UNDERPAID", {}).get("count", 0)
        
        overpaid_sum = stats_map.get("OVERPAID", {}).get("sum_diff", 0)
        underpaid_sum = stats_map.get("UNDERPAID", {}).get("sum_diff", 0)
        
        # Absolute financial delta (Leakage sum)
        total_leakage = overpaid_sum + underpaid_sum
        audited_count = clean_count + overpaid_count + underpaid_count
        
        # Compliance relative to the total audited population
        compliance_score = round((clean_count / audited_count) * 100, 1) if audited_count > 0 else 0.0

        # 2. Studio Analysis (Focus on leakage/underpaid)
        studio_stats = db.query(
            AuditResult.studio,
            func.sum(func.abs(AuditResult.difference)).label("leakage")
        ).filter(AuditResult.status == "UNDERPAID").group_by(AuditResult.studio).all()
        by_studio = {s.studio or "Unknown": round(float(s.leakage or 0), 2) for s in studio_stats}

        # 3. Content Analysis (Total impact)
        content_stats = db.query(
            AuditResult.content_id,
            func.sum(func.abs(AuditResult.difference)).label("impact")
        ).group_by(AuditResult.content_id).order_by(func.sum(func.abs(AuditResult.difference)).desc()).limit(10).all()
        by_content = {c.content_id: round(float(c.impact or 0), 2) for c in content_stats}

        # 4. Regional Heatmap (Top 4)
        region_stats = db.query(
            Contract.territory,
            func.sum(func.abs(AuditResult.difference)).label("impact")
        ).join(AuditResult, Contract.contract_id == AuditResult.contract_id).group_by(Contract.territory).order_by(func.sum(func.abs(AuditResult.difference)).desc()).limit(4).all()
        by_region = {r.territory or "Global": round(float(r.impact or 0), 2) for r in region_stats}

        # 5. Violation Distribution
        # This is a bit trickier with raw text, but we can do case statements or fetch counts
        violations = {
            "territory": db.query(func.count(AuditResult.id)).filter(AuditResult.violations.ilike("%territory%")).scalar(),
            "expiry": db.query(func.count(AuditResult.id)).filter(AuditResult.violations.ilike("%expiry%")).scalar(),
            "overpayment": db.query(func.count(AuditResult.id)).filter(AuditResult.violations.ilike("%overpayment%")).scalar(),
            "underpayment": db.query(func.count(AuditResult.id)).filter(AuditResult.violations.ilike("%underpayment%")).scalar(),
            "missing_payment": db.query(func.count(AuditResult.id)).filter(AuditResult.violations.ilike("%missing%")).scalar(),
        }

        # 6. Trend Analysis (Last 7 Days)
        now = datetime.now()
        start_date = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
        
        # PostgreSQL specific date formatting might vary, but since schema uses ISO strings we filter then format
        trend_stats = db.query(
            func.substr(AuditResult.timestamp, 1, 10).label("day"),
            func.sum(func.abs(AuditResult.difference)).label("daily_sum")
        ).filter(AuditResult.timestamp >= start_date.strftime("%Y-%m-%d")).group_by("day").all()
        
        trend_map = {datetime.strptime(t.day, "%Y-%m-%d").strftime("%d %b"): float(t.daily_sum or 0) for t in trend_stats}
        
        trend_labels = []
        trend_values = []
        for i in range(6, -1, -1):
            d = (now - timedelta(days=i)).strftime("%d %b")
            trend_labels.append(d)
            trend_values.append(round(trend_map.get(d, 0), 2))

        # 7. Category Metrics
        # Simplified category logic (first prefix of content_id)
        # Using SQLAlchemy to split on underscore is complex, so we'll fetch then group locally for this specific card
        category_stats = db.query(
            AuditResult.content_id,
            func.count(AuditResult.id).label("count"),
            func.sum(func.abs(AuditResult.difference)).label("leakage"),
            func.sum(case((AuditResult.violations != "", 1), else_=0)).label("viols")
        ).group_by(AuditResult.content_id).all()
        
        category_metrics = {}
        for c in category_stats:
            cat_name = "Global"
            if "_" in c.content_id: cat_name = c.content_id.split("_")[0]
            elif " " in c.content_id: cat_name = c.content_id.split(" ")[0]
            
            if cat_name not in category_metrics:
                category_metrics[cat_name] = {"count": 0, "leakage": 0.0, "violations": 0}
            
            category_metrics[cat_name]["count"] += c.count
            category_metrics[cat_name]["leakage"] += float(c.leakage or 0)
            category_metrics[cat_name]["violations"] += int(c.viols or 0)

        return {
            "total_leakage": round(total_leakage, 2),
            "underpaid_sum": round(underpaid_sum, 2),
            "overpaid_sum": round(overpaid_sum, 2),
            "underpaid": underpaid_count,
            "overpaid": overpaid_count,
            "clean": clean_count,
            "total_count": total_contracts,
            "audited_count": audited_count,
            "compliance_score": compliance_score,
            "violations": violations,
            "by_studio": by_studio,
            "by_content": by_content,
            "by_region": by_region,
            "category_metrics": category_metrics,
            "trend": {
                "labels": trend_labels,
                "values": trend_values
            }
        }
