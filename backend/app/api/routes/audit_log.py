from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.deps import require_admin
from app.db import get_db
from app.models import AuditLog, User
from app.schemas import AuditLogEntryOut

router = APIRouter()


@router.get("", response_model=list[AuditLogEntryOut], dependencies=[Depends(require_admin)])
def list_audit_log(
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(AuditLog, User)
        .outerjoin(User, User.id == AuditLog.actor_user_id)
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        AuditLogEntryOut(
            id=entry.id,
            actor_email=actor.email if actor else None,
            action=entry.action,
            entity_type=entry.entity_type,
            entity_id=entry.entity_id,
            details=entry.details,
            created_at=entry.created_at,
        )
        for entry, actor in rows
    ]
