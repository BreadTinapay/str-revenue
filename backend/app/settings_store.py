from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config import settings
from app.models import AppSettings

ROW_ID = 1


@dataclass
class EffectiveSettings:
    company_physical_address: str
    email_from_name: str
    email_from_address: str
    email_reply_to: str | None


def get_row(db: Session) -> AppSettings | None:
    return db.query(AppSettings).filter(AppSettings.id == ROW_ID).first()


def get_effective_settings(db: Session) -> EffectiveSettings:
    """DB overrides take precedence; anything not set there falls back to the
    env-configured default so the app keeps working before an admin ever
    visits the Settings page.
    """
    row = get_row(db)
    return EffectiveSettings(
        company_physical_address=(row.company_physical_address if row else None) or settings.company_physical_address,
        email_from_name=(row.email_from_name if row else None) or settings.email_from_name,
        email_from_address=(row.email_from_address if row else None) or settings.email_from_address,
        email_reply_to=(row.email_reply_to if row else None) or settings.email_reply_to,
    )


def update_settings(db: Session, updated_by, **fields: str | None) -> AppSettings:
    row = get_row(db)
    if row is None:
        row = AppSettings(id=ROW_ID)
        db.add(row)

    for key, value in fields.items():
        setattr(row, key, value)
    row.updated_by = updated_by
    return row
