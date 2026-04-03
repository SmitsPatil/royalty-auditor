from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.schema import AuditResult, Contract
from datetime import datetime, timedelta

class AnalyticsService:

    async def get_summary(self, db: Session, category: str = None):
        """
        Aggregate audit results specifically for the React Dashboard.
        Matches the structure expected by frontend/src/pages/Dashboard.jsx.
        """
        # Join with Contract to get territory/region data
        query = db.query(AuditResult, Contract.territory).join(Contract, AuditResult.contract_id == Contract.contract_id)
        if category:
            query = query.filter(AuditResult.content_id.ilike(f"{category}%"))
        
        results = query.all()
        
        total_leakage = 0
        underpaid_count = 0
        overpaid_count = 0
        clean_count = 0
        underpaid_sum = 0
        overpaid_sum = 0
        
        # Violation counts
        violations = {
            "territory": 0, "expiry": 0, "overpayment": 0, "underpayment": 0, "missing_payment": 0
        }
        
        by_studio = {}
        by_content = {}
        by_region = {}
        category_metrics = {}
        daily_variance = {} # For trend chart

        # Initialize last 7 days for trend
        now = datetime.now()
        for i in range(7):
            date_obj = now - timedelta(days=i)
            day_str = date_obj.strftime("%d %b")
            daily_variance[day_str] = 0

        for r, territory in results:
            impact = abs(r.difference)
            
            if r.status == "UNDERPAID":
                underpaid_count += 1
                underpaid_sum += impact
                total_leakage += impact
                # Studio leakage (underpaid focus)
                by_studio[r.studio or "Unknown"] = by_studio.get(r.studio or "Unknown", 0) + impact
            elif r.status == "OVERPAID":
                overpaid_count += 1
                overpaid_sum += impact
                total_leakage += impact
            else:
                clean_count += 1
            
            # Regional Risk (based on total variance impact)
            if impact > 0:
                region_list = [t.strip() for t in (territory or "Global").split(",")]
                primary_region = region_list[0] if region_list else "Global"
                by_region[primary_region] = by_region.get(primary_region, 0) + impact
            
            # Trend Data (group by day part of timestamp)
            try:
                # Expected: 2026-04-03T09:00:40Z
                dt = datetime.strptime(r.timestamp, "%Y-%m-%dT%H:%M:%SZ")
                ts_str = dt.strftime("%d %b")
                if ts_str in daily_variance:
                    daily_variance[ts_str] += impact
            except:
                pass

            # Violation counts
            v_text = (r.violations or "").lower()
            if "territory" in v_text: violations["territory"] += 1
            if "expiry" in v_text:    violations["expiry"] += 1
            if "overpayment" in v_text: violations["overpayment"] += 1
            if "underpayment" in v_text: violations["underpayment"] += 1
            if "missing" in v_text:   violations["missing_payment"] += 1
            
            # Group by content (total impact)
            by_content[r.content_id] = by_content.get(r.content_id, 0) + impact

            # Category logic
            cat_name = "Global"
            if "_" in r.content_id: cat_name = r.content_id.split("_")[0]
            elif " " in r.content_id: cat_name = r.content_id.split(" ")[0]
                
            if cat_name not in category_metrics:
                category_metrics[cat_name] = {"count": 0, "leakage": 0.0, "violations": 0}
            
            category_metrics[cat_name]["count"] += 1
            category_metrics[cat_name]["leakage"] += impact
            category_metrics[cat_name]["violations"] += (1 if r.violations else 0)

        # Prepare final structure
        # Sort trend chronologically
        trend_labels = list(daily_variance.keys())[::-1]
        trend_values = [round(daily_variance[l], 2) for l in trend_labels]

        return {
            "total_leakage": round(total_leakage, 2),
            "underpaid_sum": round(underpaid_sum, 2),
            "overpaid_sum": round(overpaid_sum, 2),
            "underpaid": underpaid_count,
            "overpaid": overpaid_count,
            "clean": clean_count,
            "total_count": len(results),
            "violations": violations,
            "by_studio": {k: round(v, 2) for k, v in by_studio.items()},
            "by_content": {k: round(v, 2) for k, v in by_content.items()},
            "by_region": {k: round(v, 2) for k, v in sorted(by_region.items(), key=lambda x: x[1], reverse=True)[:4]},
            "category_metrics": category_metrics,
            "trend": {
                "labels": trend_labels,
                "values": trend_values
            }
        }
