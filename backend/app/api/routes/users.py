import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.audit import log_action
from app.auth.deps import get_current_user, require_admin
from app.auth.security import hash_password, verify_password
from app.db import get_db
from app.models import User
from app.schemas import (
    ChangePasswordRequest,
    ResetPasswordRequest,
    UserCreateRequest,
    UserOut,
    UserRoleUpdateRequest,
)

router = APIRouter()

VALID_ROLES = {"admin", "viewer"}


@router.get("", response_model=list[UserOut], dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at).all()


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.post("", response_model=UserOut)
def create_user(
    request: UserCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if request.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {sorted(VALID_ROLES)}")

    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    user = User(
        id=uuid.uuid4(),
        email=request.email,
        password_hash=hash_password(request.password),
        role=request.role,
    )
    db.add(user)
    log_action(db, admin.id, "user.create", "user", user.id, {"email": user.email, "role": user.role})
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: str,
    request: UserRoleUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if request.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {sorted(VALID_ROLES)}")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id and request.role != "admin":
        raise HTTPException(status_code=400, detail="You cannot demote your own account")

    previous_role = user.role
    user.role = request.role
    log_action(db, admin.id, "user.role_change", "user", user.id, {"from": previous_role, "to": request.role})
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    if str(admin.id) == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    log_action(db, admin.id, "user.delete", "user", user.id, {"email": user.email})
    db.delete(user)
    db.commit()
    return {"status": "deleted"}


@router.post("/{user_id}/reset-password")
def reset_user_password(
    user_id: str,
    request: ResetPasswordRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(request.new_password)
    log_action(db, admin.id, "user.reset_password", "user", user.id, {"email": user.email})
    db.commit()
    return {"status": "password_reset"}


@router.post("/me/change-password")
def change_own_password(
    request: ChangePasswordRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(request.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")

    user.password_hash = hash_password(request.new_password)
    log_action(db, user.id, "user.change_password", "user", user.id, None)
    db.commit()
    return {"status": "password_changed"}
