from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.audit import log_action
from app.auth.deps import require_admin
from app.db import get_db
from app.models import User
from app.schemas import AppSettingsOut, AppSettingsUpdateRequest
from app.settings_store import get_effective_settings, update_settings

router = APIRouter()


@router.get("", response_model=AppSettingsOut, dependencies=[Depends(require_admin)])
def get_settings(db: Session = Depends(get_db)):
    return get_effective_settings(db).__dict__


@router.put("", response_model=AppSettingsOut)
def put_settings(
    request: AppSettingsUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    update_settings(
        db,
        admin.id,
        company_physical_address=request.company_physical_address,
        email_from_name=request.email_from_name,
        email_from_address=request.email_from_address,
        email_reply_to=request.email_reply_to,
    )
    log_action(db, admin.id, "settings.update", "app_settings", None, request.model_dump())
    db.commit()
    return get_effective_settings(db).__dict__
