import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import SuppressionEntry


def is_suppressed(db: Session, email: str) -> bool:
    return db.query(SuppressionEntry).filter(SuppressionEntry.email == email.lower()).first() is not None


def suppress(db: Session, email: str, reason: str, source: str | None = None) -> None:
    """Add an email to the suppression list. Idempotent — suppressing an
    already-suppressed address is a no-op, never an error.
    """
    email = email.lower()
    existing = db.query(SuppressionEntry).filter(SuppressionEntry.email == email).first()
    if existing:
        return

    db.add(
        SuppressionEntry(
            id=uuid.uuid4(),
            email=email,
            reason=reason,
            source=source,
            suppressed_at=datetime.utcnow(),
        )
    )
    db.commit()
