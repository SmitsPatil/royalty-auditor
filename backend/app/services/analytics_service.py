from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.schema import AuditResult, Contract

class AnalyticsService:

    async def get_summary(self, db: Session, category: str = None):
        """
        Aggregate audit results specifically for the React Dashboard.
        Matches the keys and structure expected by frontend/src/pages/Dashboard.jsx.
        """
        # Join with Contract to get territory/region data
        query = db.query(AuditResult, Contract.territory).join(Contract, AuditResult.contract_id == Contract.contract_id)
        if category:
            query = query.filter(AuditResult.content_id.ilike(f"{category}%"))
        
        results = query.all()
        
        total_leakage = 0
        underpaid = 0
        overpaid = 0
        clean = 0
        
        # Violation counts
        violations = {
            "territory": 0,
            "expiry": 0,
            "overpayment": 0,
            "underpayment": 0,
            "missing_payment": 0
        }
        
        by_studio = {}
        by_content = {}
        by_region = {}  # New: Regional risk heatmap data
        category_metrics = {}

        for r, territory in results:
            has_leakage = (r.status == "UNDERPAID")
            has_overpaid = (r.status == "OVERPAID")
            has_violations = bool(r.violations and r.violations.strip())

            if has_leakage or has_overpaid:
                impact = abs(r.difference)
                total_leakage += impact
                if has_leakage: 
                    underpaid += 1
                    # Track regional risk based on underpayment variance
                    region_list = [t.strip() for t in (territory or "Global").split(",")]
                    primary_region = region_list[0] if region_list else "Global"
                    by_region[primary_region] = by_region.get(primary_region, 0) + impact
                else: 
                    overpaid += 1
            
            # A contract is "Clean" if no leakage, overpaid, or violations
            if not has_leakage and not has_overpaid and not has_violations:
                clean += 1
            
            # Count specific violation types
            v_text = (r.violations or "").lower()
            if "territory" in v_text: violations["territory"] += 1
            if "expiry" in v_text:    violations["expiry"] += 1
            if "overpayment" in v_text: violations["overpayment"] += 1
            if "underpayment" in v_text: violations["underpayment"] += 1
            if "missing" in v_text:   violations["missing_payment"] += 1
            
            # Group by studio
            by_studio[r.studio or "Unknown"] = by_studio.get(r.studio or "Unknown", 0) + (abs(r.difference) if r.status == "UNDERPAID" else 0)
            
            # Group by content
            by_content[r.content_id] = by_content.get(r.content_id, 0) + abs(r.difference)

            # Category logic
            cat_name = "Global"
            if "_" in r.content_id: cat_name = r.content_id.split("_")[0]
            elif " " in r.content_id: cat_name = r.content_id.split(" ")[0]
                
            if cat_name not in category_metrics:
                category_metrics[cat_name] = {"count": 0, "leakage": 0.0, "violations": 0}
            
            category_metrics[cat_name]["count"] += 1
            category_metrics[cat_name]["leakage"] += (abs(r.difference) if r.status == "UNDERPAID" else 0)
            category_metrics[cat_name]["violations"] += (1 if r.violations else 0)

        # Round values and return top 4 regions for mini-bar
        total_leakage = round(total_leakage, 2)
        top_regions = dict(sorted(by_region.items(), key=lambda item: item[1], reverse=True)[:4])
        for k in top_regions: top_regions[k] = round(top_regions[k], 2)

        return {
            "total_leakage": total_leakage,
            "underpaid": underpaid,
            "overpaid": overpaid,
            "clean": clean,
            "total_count": len(results),
            "violations": violations,
            "by_studio": by_studio,
            "by_content": by_content,
            "by_region": top_regions,
            "category_metrics": category_metrics
        }
