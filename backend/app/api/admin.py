from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
import uuid

from app.db.database import get_db
from app.db.models import User, InviteKey
from app.api.auth import admin_required, UserResponse

router = APIRouter()

class InviteKeyResponse(BaseModel):
    key: str
    created_at: str
    is_used: int
    used_by: int | None

    class Config:
        from_attributes = True

@router.get("/users", response_model=List[UserResponse])
def get_all_users(db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    users = db.query(User).all()
    return users

class UserRoleUpdate(BaseModel):
    role: str

@router.patch("/users/{user_id}/role", response_model=UserResponse)
def update_user_role(user_id: int, payload: UserRoleUpdate, db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    if payload.role not in ["admin", "user"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = payload.role
    db.commit()
    db.refresh(user)
    return user

class UserStatusUpdate(BaseModel):
    is_active: int

@router.patch("/users/{user_id}/status", response_model=UserResponse)
def update_user_status(user_id: int, payload: UserStatusUpdate, db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    if payload.is_active not in [0, 1]:
        raise HTTPException(status_code=400, detail="Invalid status")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Prevent disabling yourself
    if user.id == current_admin.id and payload.is_active == 0:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")
    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user

@router.post("/invites", response_model=InviteKeyResponse)
def generate_invite(db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    new_key_str = f"INVITE-{str(uuid.uuid4())[:8].upper()}"
    new_key = InviteKey(
        key=new_key_str,
        created_by=current_admin.id
    )
    db.add(new_key)
    db.commit()
    db.refresh(new_key)
    
    return {
        "key": new_key.key,
        "created_at": new_key.created_at.isoformat(),
        "is_used": new_key.is_used,
        "used_by": new_key.used_by
    }

@router.get("/invites", response_model=List[InviteKeyResponse])
def list_invites(db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    keys = db.query(InviteKey).order_by(InviteKey.created_at.desc()).all()
    # Serialize datetime manually
    res = []
    for k in keys:
        res.append({
            "key": k.key,
            "created_at": k.created_at.isoformat() if k.created_at else "",
            "is_used": k.is_used,
            "used_by": k.used_by
        })
    return res
