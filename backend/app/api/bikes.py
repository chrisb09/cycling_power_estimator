from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from app.db.database import get_db
from app.db.models import Bike, User
from app.api.auth import get_current_user

router = APIRouter()

class BikeCreate(BaseModel):
    name: str
    weight_kg: float
    tire_type: str
    drivetrain_efficiency: float

class BikeResponse(BikeCreate):
    id: int
    user_id: int

    class Config:
        from_attributes = True

@router.get("/", response_model=List[BikeResponse])
def get_bikes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Bike).filter(Bike.user_id == current_user.id).all()

@router.post("/", response_model=BikeResponse)
def create_bike(bike: BikeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_bike = Bike(
        user_id=current_user.id,
        name=bike.name,
        weight_kg=bike.weight_kg,
        tire_type=bike.tire_type,
        drivetrain_efficiency=bike.drivetrain_efficiency
    )
    db.add(new_bike)
    db.commit()
    db.refresh(new_bike)
    return new_bike
