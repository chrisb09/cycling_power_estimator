from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
import jwt

from app.db.database import get_db
from app.db.models import User
from app.auth import get_password_hash, verify_password, create_access_token, SECRET_KEY, ALGORITHM

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login", auto_error=False)

class UserCreate(BaseModel):
    username: str
    password: str
    invite_key: str
    weight_kg: float = 75.0
    height_cm: float = 175.0

class Token(BaseModel):
    access_token: str
    token_type: str

def get_current_user_optional(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except jwt.PyJWTError:
        return None
    user = db.query(User).filter(User.username == username).first()
    return user

def get_current_user(user: User = Depends(get_current_user_optional)):
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    return user

def admin_required(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user

@router.post("/register", response_model=Token)
def register(user: UserCreate, db: Session = Depends(get_db)):
    # Validate Invite Key
    from app.db.models import InviteKey
    key_record = db.query(InviteKey).filter(InviteKey.key == user.invite_key, InviteKey.is_used == 0).first()
    if not key_record:
        raise HTTPException(status_code=400, detail="Invalid or expired invite key")

    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    new_user = User(
        username=user.username,
        password_hash=hashed_password,
        weight_kg=user.weight_kg,
        height_cm=user.height_cm,
        role="user",
        is_active=1
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Mark invite key as used
    key_record.is_used = 1
    key_record.used_by = new_user.id
    db.commit()
    
    access_token = create_access_token(data={"sub": new_user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
        
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

class UserResponse(BaseModel):
    id: int
    username: str
    weight_kg: float
    height_cm: float
    role: str
    is_active: int
    default_ride_visibility: str
    profile_visibility: str

    class Config:
        from_attributes = True

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

class UserSettingsUpdate(BaseModel):
    weight_kg: float | None = None
    height_cm: float | None = None
    default_ride_visibility: str | None = None
    profile_visibility: str | None = None

@router.patch("/me", response_model=UserResponse)
def update_me(payload: UserSettingsUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.weight_kg is not None:
        current_user.weight_kg = payload.weight_kg
    if payload.height_cm is not None:
        current_user.height_cm = payload.height_cm
    if payload.default_ride_visibility is not None:
        current_user.default_ride_visibility = payload.default_ride_visibility
    if payload.profile_visibility is not None:
        current_user.profile_visibility = payload.profile_visibility
    db.commit()
    db.refresh(current_user)
    return current_user

class InviteDetailsResponse(BaseModel):
    key: str
    creator_username: str
    is_used: int

@router.get("/invites/{key}", response_model=InviteDetailsResponse)
def get_invite_details(key: str, db: Session = Depends(get_db)):
    from app.db.models import InviteKey
    key_record = db.query(InviteKey).filter(InviteKey.key == key).first()
    if not key_record:
        raise HTTPException(status_code=404, detail="Invite key not found")
    creator = db.query(User).filter(User.id == key_record.created_by).first()
    return {
        "key": key_record.key,
        "creator_username": creator.username if creator else "Admin",
        "is_used": key_record.is_used
    }
