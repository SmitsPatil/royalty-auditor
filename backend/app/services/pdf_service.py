import pdfplumber
import re
from sqlalchemy.orm import Session
from app.models.schema import Contract

class PDFService:

    async def process_pdf(self, file, db: Session):
        # Read PDF
        with pdfplumber.open(file.file) as pdf:
            text = ""
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"

        # Extract fields
        data = self.parse_contract(text)

        # Save to SQLite
        content_id_val = data.get("content_id") or "UNKNOWN"
        contract = Contract(
            contract_id="PDF_" + content_id_val,
            content_id=content_id_val,
            studio="Unknown",
            rate_per_play=0.0,
            tier_rate=0.0,
            tier_threshold=0,
            territory=data.get("territory") or "Unknown",
            start_date=data.get("start_date") or "Unknown",
            end_date=data.get("end_date") or "Unknown",
            royalty_rate=float(data.get("royalty_percent") or 0.0),
            is_deleted=0
        )

        db.merge(contract)
        db.commit()

        return {"status": "success", "extracted": data}

    def parse_contract(self, text):
        def safe(pattern):
            match = re.search(pattern, text, re.IGNORECASE)
            return match.group(1).strip() if match else None

        # Content (more precise)
        content = safe(r'movie\s+[“"]([^”"]+)[”"]')

        # Territory
        territory = safe(r'(India|US|UK|CA|IN)\s+region')

        # Dates
        start_date = safe(r'Start Date:\s*([\w\s,]+)')
        end_date = safe(r'End Date:\s*([\w\s,]+)')

        # Royalty
        royalty = safe(r'(\d+)%')

        # Minimum guarantee
        min_guarantee = safe(r'₹\s?([\d,]+)')

        return {
            "content_id": content,
            "territory": territory,
            "start_date": start_date,
            "end_date": end_date,
            "royalty_percent": royalty,
            "min_guarantee": min_guarantee
        }
