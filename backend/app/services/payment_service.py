import csv
import io
from sqlalchemy.orm import Session
from app.models.schema import Payment
from datetime import datetime

class PaymentService:

    async def upload_payments_csv(self, csv_content: str, db: Session):
        f = io.StringIO(csv_content)
        reader = csv.DictReader(f)
        
        payments_to_add = []
        for row in reader:
            payment = {
                "payment_id":   row.get("payment_id") or f"PAY_{datetime.utcnow().timestamp()}",
                "content_id":   row.get("content_id"),
                "contract_id":  row.get("contract_id"),
                "amount_paid":  float(row.get("amount_paid", 0)),
                "payment_date": row.get("payment_date") or datetime.utcnow().isoformat()
            }
            payments_to_add.append(payment)

        if payments_to_add:
            # Use bulk_insert_mappings for speed
            db.bulk_insert_mappings(Payment, payments_to_add)
            db.commit()

        return {"status": "success", "count": len(payments_to_add)}

    def get_payments_by_contract(self, db: Session, contract_id: str):
        return db.query(Payment).filter(Payment.contract_id == contract_id).all()

    def get_payments_by_content(self, db: Session, content_id: str):
        return db.query(Payment).filter(Payment.content_id == content_id).all()
