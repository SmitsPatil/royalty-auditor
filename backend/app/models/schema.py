from sqlalchemy import Column, String, Float, Integer, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Contract(Base):
    __tablename__ = "contracts"

    contract_id   = Column(String, primary_key=True, index=True)
    content_id    = Column(String, index=True)
    studio        = Column(String)
    royalty_rate  = Column(Float, default=0.0)   # % shown in UI
    rate_per_play = Column(Float, default=0.0)
    tier_rate     = Column(Float, default=0.0)
    tier_threshold= Column(Integer, default=0)
    territory     = Column(String)               # comma-separated, e.g. "US,CA,UK"
    start_date    = Column(String)
    end_date      = Column(String)
    
    # Soft deletion & TTL fields
    is_deleted      = Column(Integer, default=0) # 0=False, 1=True (sqlite bools)
    deleted_at      = Column(String, nullable=True)
    auto_expunge_at = Column(String, nullable=True)


class ContractVersion(Base):
    __tablename__ = "contract_versions"
    
    id            = Column(Integer, primary_key=True, autoincrement=True)
    contract_id   = Column(String, index=True)
    modified_at   = Column(String)
    previous_data = Column(Text) # JSON serialized copy of previous state
class Log(Base):
    __tablename__ = "logs"

    play_id    = Column(String, primary_key=True, index=True)
    content_id = Column(String, index=True)
    contract_id= Column(String, index=True)
    timestamp  = Column(String)
    country    = Column(String)
    plays      = Column(Integer, default=0)
    user_type  = Column(String)
    device     = Column(String)


class Payment(Base):
    __tablename__ = "payments"

    payment_id   = Column(String, primary_key=True, index=True)
    content_id   = Column(String, index=True)
    contract_id  = Column(String, index=True)
    amount_paid  = Column(Float, default=0.0)
    payment_date = Column(String)


class AuditResult(Base):
    __tablename__ = "audit_results"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    contract_id = Column(String, index=True)
    content_id  = Column(String, index=True)
    studio      = Column(String)
    expected    = Column(Float, default=0.0)
    paid        = Column(Float, default=0.0)
    difference  = Column(Float, default=0.0)
    status      = Column(String)               # OVERPAID | UNDERPAID | OK
    violations  = Column(Text, default="")     # pipe-separated violation messages
    total_plays = Column(Integer, default=0)
    timestamp   = Column(String)
