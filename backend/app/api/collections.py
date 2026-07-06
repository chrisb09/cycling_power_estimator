from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid
from app.db.database import get_db
from app.db.models import Collection, CollectionRide, Ride, User
from app.api.auth import get_current_user, get_current_user_optional

router = APIRouter()


class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    visibility: str = "private"
    ride_ids: Optional[List[int]] = None


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[str] = None
    ride_ids: Optional[List[int]] = None


class RideRef(BaseModel):
    id: int
    name: str
    date: datetime
    distance_km: Optional[float] = None
    moving_time_s: Optional[float] = None
    avg_power_watts: Optional[float] = None
    normalized_power_watts: Optional[float] = None
    total_work_kj: Optional[float] = None
    location: Optional[str] = None
    visibility: str = "private"

    class Config:
        from_attributes = True


class DayBreakdown(BaseModel):
    date: str
    total_distance_km: float
    total_time_s: float
    total_work_kj: float
    ride_count: int
    rides: List[RideRef]


class CombinedStats(BaseModel):
    total_distance_km: float
    total_time_s: float
    total_work_kj: float
    ride_count: int
    avg_power_watts: Optional[float] = None
    normalized_power_watts: Optional[float] = None


class CollectionResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    visibility: str = "private"
    share_token: Optional[str] = None
    rides: List[RideRef] = []
    stats: Optional[CombinedStats] = None
    days: Optional[List[DayBreakdown]] = None

    class Config:
        from_attributes = True


VALID_VISIBILITY = {"private", "unlisted", "public"}


def compute_combined_stats(rides):
    total_dist = sum((r.distance_km or 0) for r in rides)
    total_time = sum((r.moving_time_s or 0) for r in rides)
    total_work = sum((r.total_work_kj or 0) for r in rides)
    count = len(rides)

    avg_power = None
    if total_time > 0 and count > 0:
        weighted_power = sum(
            (r.avg_power_watts or 0) * (r.moving_time_s or 0) for r in rides
        )
        avg_power = weighted_power / total_time if total_time > 0 else None

    np_val = None
    if count > 0 and total_time > 0:
        weighted_np = sum(
            (r.normalized_power_watts or 0) * (r.moving_time_s or 0) for r in rides
        )
        np_val = weighted_np / total_time if total_time > 0 else None

    return CombinedStats(
        total_distance_km=round(total_dist, 2),
        total_time_s=round(total_time, 1),
        total_work_kj=round(total_work, 1),
        ride_count=count,
        avg_power_watts=round(avg_power, 1) if avg_power else None,
        normalized_power_watts=round(np_val, 1) if np_val else None,
    )


def compute_day_breakdown(rides):
    from collections import defaultdict
    days = defaultdict(list)
    for r in rides:
        day = r.date.strftime("%Y-%m-%d") if r.date else "Unknown"
        days[day].append(r)

    result = []
    for day_label in sorted(days.keys()):
        day_rides = days[day_label]
        day_dist = sum((r.distance_km or 0) for r in day_rides)
        day_time = sum((r.moving_time_s or 0) for r in day_rides)
        day_work = sum((r.total_work_kj or 0) for r in day_rides)
        result.append(DayBreakdown(
            date=day_label,
            total_distance_km=round(day_dist, 2),
            total_time_s=round(day_time, 1),
            total_work_kj=round(day_work, 1),
            ride_count=len(day_rides),
            rides=[RideRef.model_validate(r) for r in day_rides],
        ))
    return result


def get_collection_with_access(collection_id, db, current_user, token=None):
    collection = db.query(Collection).options(
        joinedload(Collection.rides).joinedload(CollectionRide.ride)
    ).filter(Collection.id == collection_id).first()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    owner = db.query(User).filter(User.id == collection.user_id).first()
    is_owner = current_user and current_user.id == collection.user_id
    is_admin = current_user and current_user.role == "admin"

    has_access = False
    if is_owner or is_admin:
        has_access = True
    elif collection.visibility == "public":
        has_access = True
    elif collection.visibility == "unlisted" and token and collection.share_token == token:
        has_access = True

    if not has_access:
        raise HTTPException(status_code=403, detail="Not authorized to view this collection")

    return collection, is_owner


@router.get("/", response_model=List[CollectionResponse])
def get_collections(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    collections = db.query(Collection).filter(
        Collection.user_id == current_user.id
    ).order_by(Collection.created_at.desc()).all()

    result = []
    for c in collections:
        rides = [cr.ride for cr in sorted(c.rides, key=lambda x: x.position) if cr.ride]
        result.append(CollectionResponse(
            id=c.id,
            user_id=c.user_id,
            name=c.name,
            description=c.description,
            created_at=c.created_at,
            visibility=c.visibility,
            share_token=c.share_token,
            rides=[RideRef.model_validate(r) for r in rides],
            stats=compute_combined_stats(rides),
        ))
    return result


@router.get("/user/{username}", response_model=List[CollectionResponse])
def get_public_collections(username: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_owner_or_admin = current_user and (current_user.id == user.id or current_user.role == "admin")
    query = db.query(Collection).filter(Collection.user_id == user.id)
    if is_owner_or_admin:
        collections = query.order_by(Collection.created_at.desc()).all()
    else:
        collections = query.filter(Collection.visibility == "public").order_by(Collection.created_at.desc()).all()

    result = []
    for c in collections:
        rides = [cr.ride for cr in sorted(c.rides, key=lambda x: x.position) if cr.ride]
        result.append(CollectionResponse(
            id=c.id,
            user_id=c.user_id,
            name=c.name,
            description=c.description,
            created_at=c.created_at,
            visibility=c.visibility,
            rides=[RideRef.model_validate(r) for r in rides],
            stats=compute_combined_stats(rides),
        ))
    return result


@router.get("/{collection_id}", response_model=CollectionResponse)
def get_collection(
    collection_id: int,
    token: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    collection, is_owner = get_collection_with_access(collection_id, db, current_user, token)
    rides = [cr.ride for cr in sorted(collection.rides, key=lambda x: x.position) if cr.ride]

    return CollectionResponse(
        id=collection.id,
        user_id=collection.user_id,
        name=collection.name,
        description=collection.description,
        created_at=collection.created_at,
        visibility=collection.visibility,
        share_token=collection.share_token if is_owner else None,
        rides=[RideRef.model_validate(r) for r in rides],
        stats=compute_combined_stats(rides),
        days=compute_day_breakdown(rides),
    )


@router.post("/", response_model=CollectionResponse)
def create_collection(
    payload: CollectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.visibility not in VALID_VISIBILITY:
        raise HTTPException(status_code=400, detail="Invalid visibility value")

    collection = Collection(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        visibility=payload.visibility,
    )
    db.add(collection)
    db.flush()

    if payload.ride_ids:
        for pos, ride_id in enumerate(payload.ride_ids):
            ride = db.query(Ride).filter(
                Ride.id == ride_id, Ride.user_id == current_user.id
            ).first()
            if ride:
                cr = CollectionRide(collection_id=collection.id, ride_id=ride.id, position=pos)
                db.add(cr)

    db.commit()
    db.refresh(collection)

    rides = [cr.ride for cr in sorted(collection.rides, key=lambda x: x.position) if cr.ride]
    return CollectionResponse(
        id=collection.id,
        user_id=collection.user_id,
        name=collection.name,
        description=collection.description,
        created_at=collection.created_at,
        visibility=collection.visibility,
        rides=[RideRef.model_validate(r) for r in rides],
        stats=compute_combined_stats(rides),
        days=compute_day_breakdown(rides),
    )


@router.patch("/{collection_id}", response_model=CollectionResponse)
def update_collection(
    collection_id: int,
    payload: CollectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = db.query(Collection).filter(
        Collection.id == collection_id, Collection.user_id == current_user.id
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    if payload.name is not None:
        collection.name = payload.name
    if payload.description is not None:
        collection.description = payload.description
    if payload.visibility is not None:
        if payload.visibility not in VALID_VISIBILITY:
            raise HTTPException(status_code=400, detail="Invalid visibility value")
        collection.visibility = payload.visibility

    if payload.ride_ids is not None:
        existing = {cr.ride_id for cr in collection.rides}
        new_set = set(payload.ride_ids)
        for cr in list(collection.rides):
            if cr.ride_id not in new_set:
                db.delete(cr)
        for pos, ride_id in enumerate(payload.ride_ids):
            if ride_id not in existing:
                ride = db.query(Ride).filter(
                    Ride.id == ride_id, Ride.user_id == current_user.id
                ).first()
                if ride:
                    cr = CollectionRide(collection_id=collection.id, ride_id=ride.id, position=pos)
                    db.add(cr)
            else:
                # Update position for existing entries
                cr = next((cr for cr in collection.rides if cr.ride_id == ride_id), None)
                if cr:
                    cr.position = pos

    db.commit()
    db.refresh(collection)

    rides = [cr.ride for cr in sorted(collection.rides, key=lambda x: x.position) if cr.ride]
    return CollectionResponse(
        id=collection.id,
        user_id=collection.user_id,
        name=collection.name,
        description=collection.description,
        created_at=collection.created_at,
        visibility=collection.visibility,
        share_token=collection.share_token,
        rides=[RideRef.model_validate(r) for r in rides],
        stats=compute_combined_stats(rides),
        days=compute_day_breakdown(rides),
    )


@router.post("/{collection_id}/rides")
def add_ride_to_collection(
    collection_id: int,
    ride_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = db.query(Collection).filter(
        Collection.id == collection_id, Collection.user_id == current_user.id
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    ride = db.query(Ride).filter(
        Ride.id == ride_id, Ride.user_id == current_user.id
    ).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    exists = db.query(CollectionRide).filter(
        CollectionRide.collection_id == collection_id,
        CollectionRide.ride_id == ride_id,
    ).first()
    if exists:
        return {"status": "already_exists"}

    max_pos = db.query(CollectionRide.position).filter(
        CollectionRide.collection_id == collection_id
    ).order_by(CollectionRide.position.desc()).first()
    next_pos = (max_pos[0] + 1) if max_pos else 0

    cr = CollectionRide(collection_id=collection_id, ride_id=ride_id, position=next_pos)
    db.add(cr)
    db.commit()
    return {"status": "success"}


@router.delete("/{collection_id}/rides/{ride_id}")
def remove_ride_from_collection(
    collection_id: int,
    ride_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = db.query(Collection).filter(
        Collection.id == collection_id, Collection.user_id == current_user.id
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    cr = db.query(CollectionRide).filter(
        CollectionRide.collection_id == collection_id,
        CollectionRide.ride_id == ride_id,
    ).first()
    if not cr:
        raise HTTPException(status_code=404, detail="Ride not in collection")

    db.delete(cr)
    db.commit()
    return {"status": "success"}


@router.delete("/{collection_id}")
def delete_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = db.query(Collection).filter(
        Collection.id == collection_id, Collection.user_id == current_user.id
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    db.delete(collection)
    db.commit()
    return {"status": "success"}


@router.post("/{collection_id}/share")
def generate_share_token(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = db.query(Collection).filter(
        Collection.id == collection_id, Collection.user_id == current_user.id
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    collection.share_token = str(uuid.uuid4())
    db.commit()
    return {"share_token": collection.share_token}
