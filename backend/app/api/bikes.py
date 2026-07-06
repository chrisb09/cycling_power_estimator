from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.db.database import get_db
from app.db.models import Bike, User, Ride
from app.api.auth import get_current_user

router = APIRouter()


class BikeCreate(BaseModel):
    name: str
    weight_kg: float
    tire_type: str
    drivetrain: str = "average"
    default_riding_position: Optional[str] = None


class BikeUpdate(BaseModel):
    name: Optional[str] = None
    weight_kg: Optional[float] = None
    tire_type: Optional[str] = None
    drivetrain: Optional[str] = None
    default_riding_position: Optional[str] = None


class BikeResponse(BaseModel):
    id: int
    user_id: int
    name: str
    weight_kg: float
    tire_type: str
    drivetrain: str
    default_riding_position: Optional[str] = None

    class Config:
        from_attributes = True


VALID_TIRE_TYPES = {"slick", "commuter", "gravel", "mtb"}
VALID_DRIVETRAIN = {"optimized", "average", "dirty"}
VALID_POSITIONS = {"tops", "hoods", "drops", "aero"}


def validate_bike_fields(name=None, weight_kg=None, tire_type=None, drivetrain=None, default_riding_position=None):
    if tire_type is not None and tire_type not in VALID_TIRE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid tire_type: {tire_type}")
    if drivetrain is not None and drivetrain not in VALID_DRIVETRAIN:
        raise HTTPException(status_code=400, detail=f"Invalid drivetrain: {drivetrain}")
    if default_riding_position is not None and default_riding_position not in VALID_POSITIONS:
        raise HTTPException(status_code=400, detail=f"Invalid position: {default_riding_position}")
    if weight_kg is not None and weight_kg < 0:
        raise HTTPException(status_code=400, detail="weight_kg must be non-negative")


@router.get("/", response_model=List[BikeResponse])
def get_bikes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Bike).filter(Bike.user_id == current_user.id).all()


@router.get("/{bike_id}", response_model=BikeResponse)
def get_bike(bike_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bike = db.query(Bike).filter(Bike.id == bike_id, Bike.user_id == current_user.id).first()
    if not bike:
        raise HTTPException(status_code=404, detail="Bike not found")
    return bike


@router.post("/", response_model=BikeResponse)
def create_bike(bike: BikeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    validate_bike_fields(
        tire_type=bike.tire_type,
        drivetrain=bike.drivetrain,
        default_riding_position=bike.default_riding_position,
    )
    new_bike = Bike(
        user_id=current_user.id,
        name=bike.name,
        weight_kg=bike.weight_kg,
        tire_type=bike.tire_type,
        drivetrain=bike.drivetrain,
        default_riding_position=bike.default_riding_position,
    )
    db.add(new_bike)
    db.commit()
    db.refresh(new_bike)
    return new_bike


@router.patch("/{bike_id}", response_model=BikeResponse)
def update_bike(bike_id: int, payload: BikeUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bike = db.query(Bike).filter(Bike.id == bike_id, Bike.user_id == current_user.id).first()
    if not bike:
        raise HTTPException(status_code=404, detail="Bike not found")

    validate_bike_fields(
        tire_type=payload.tire_type,
        drivetrain=payload.drivetrain,
        default_riding_position=payload.default_riding_position,
    )

    if payload.name is not None:
        bike.name = payload.name
    if payload.weight_kg is not None:
        bike.weight_kg = payload.weight_kg
    if payload.tire_type is not None:
        bike.tire_type = payload.tire_type
    if payload.drivetrain is not None:
        bike.drivetrain = payload.drivetrain
    if payload.default_riding_position is not None:
        bike.default_riding_position = payload.default_riding_position

    db.commit()
    db.refresh(bike)
    return bike


@router.delete("/{bike_id}")
def delete_bike(bike_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bike = db.query(Bike).filter(Bike.id == bike_id, Bike.user_id == current_user.id).first()
    if not bike:
        raise HTTPException(status_code=404, detail="Bike not found")

    # Nullify bike_id on all rides that reference this bike
    db.query(Ride).filter(Ride.bike_id == bike_id).update({"bike_id": None})
    db.delete(bike)
    db.commit()
    return {"status": "success"}
