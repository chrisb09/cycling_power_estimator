from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid
from app.db.database import get_db
from app.db.models import Ride, User
from app.api.auth import get_current_user, get_current_user_optional
import os
import json

router = APIRouter()
CURRENT_ANALYSIS_VERSION = 3

class RideResponse(BaseModel):
    id: int
    name: str
    date: datetime
    riding_position: str
    avg_power_watts: float
    normalized_power_watts: float
    total_work_kj: float
    distance_km: float | None = None
    moving_time_s: float | None = None
    location: str | None = None
    visibility: str = "private"
    share_token: str | None = None

    class Config:
        from_attributes = True

@router.get("/", response_model=List[RideResponse])
def get_rides(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rides = db.query(Ride).filter(Ride.user_id == current_user.id).order_by(Ride.date.desc()).all()
    return rides

@router.delete("/{ride_id}")
def delete_ride(ride_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ride = db.query(Ride).filter(Ride.id == ride_id, Ride.user_id == current_user.id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride.gpx_file_path and os.path.exists(ride.gpx_file_path):
        try:
            os.remove(ride.gpx_file_path)
        except Exception:
            pass
            
    db.delete(ride)
    db.commit()
    return {"status": "success"}

class RideUpdateRequest(BaseModel):
    name: Optional[str] = None
    visibility: Optional[str] = None
    generate_token: Optional[bool] = False

@router.patch("/{ride_id}")
def update_ride(ride_id: int, payload: RideUpdateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ride = db.query(Ride).filter(Ride.id == ride_id, Ride.user_id == current_user.id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
        
    if payload.name is not None:
        ride.name = payload.name
    if payload.visibility in ["private", "unlisted", "public"]:
        ride.visibility = payload.visibility
    if payload.generate_token:
        ride.share_token = str(uuid.uuid4())
        
    db.commit()
    db.refresh(ride)
    return ride

class ProfileStats(BaseModel):
    total_rides: int
    total_work_kj: float
    total_distance_km: float
    total_time_s: float
    avg_speed_kmh: float
    avg_distance_km: float
    avg_time_s: float

class UserProfileResponse(BaseModel):
    username: str
    first_name: Optional[str]
    last_name: Optional[str]
    location: Optional[str]
    profile_picture: Optional[str]
    stats: ProfileStats
    public_rides: List[RideResponse]
    unlisted_rides: List[RideResponse] = []
    private_rides: List[RideResponse] = []

@router.get("/user/{username}", response_model=UserProfileResponse)
def get_public_profile(username: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    is_owner_or_admin = False
    if current_user and (current_user.id == user.id or current_user.role == "admin"):
        is_owner_or_admin = True
        
    has_access = False
    if user.profile_visibility == "public":
        has_access = True
    elif current_user:
        if is_owner_or_admin:
            has_access = True
        elif user.profile_visibility == "internal":
            has_access = True
            
    if not has_access:
        raise HTTPException(status_code=403, detail="Profile is private")

    all_rides = db.query(Ride).filter(Ride.user_id == user.id).order_by(Ride.date.desc()).all()
    
    public_rides = [r for r in all_rides if r.visibility == "public"]
    unlisted_rides = []
    private_rides = []
    
    if is_owner_or_admin:
        unlisted_rides = [r for r in all_rides if r.visibility == "unlisted"]
        private_rides = [r for r in all_rides if r.visibility == "private"]
        visible_rides = all_rides
    else:
        visible_rides = public_rides

    # Calculate stats over visible rides
    total_work = sum((r.total_work_kj or 0) for r in visible_rides)
    total_dist = sum((r.distance_km or 0) for r in visible_rides)
    total_time = sum((r.moving_time_s or 0) for r in visible_rides)
    count = len(visible_rides)
    
    avg_speed = (total_dist / (total_time / 3600.0)) if total_time > 0 else 0.0
    
    stats = ProfileStats(
        total_rides=count,
        total_work_kj=total_work,
        total_distance_km=total_dist,
        total_time_s=total_time,
        avg_speed_kmh=avg_speed,
        avg_distance_km=(total_dist / count) if count > 0 else 0.0,
        avg_time_s=(total_time / count) if count > 0 else 0.0
    )

    return UserProfileResponse(
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        location=user.location,
        profile_picture=user.profile_picture,
        stats=stats,
        public_rides=public_rides,
        unlisted_rides=unlisted_rides,
        private_rides=private_rides
    )

@router.get("/{ride_id}/analyze")
async def analyze_saved_ride(ride_id: int, token: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_optional)):
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
        
    has_access = False
    if current_user and current_user.id == ride.user_id:
        has_access = True
    elif current_user and current_user.role == "admin":
        has_access = True
    elif ride.visibility in ["public", "unlisted"]:
        has_access = True
    elif token and ride.share_token == token:
        has_access = True
        
    if not has_access:
        raise HTTPException(status_code=403, detail="Not authorized to view this ride")
        
    if ride.analysis_cache and ride.analysis_version == CURRENT_ANALYSIS_VERSION:
        try:
            return json.loads(ride.analysis_cache)
        except Exception:
            pass # Fallback to recomputing if JSON is corrupt
            
    if not ride.gpx_file_path or not os.path.exists(ride.gpx_file_path):
        raise HTTPException(status_code=404, detail="GPX file missing from storage")
        
    # We must import these here or top-level to avoid circular imports if any, but top level is better.
    # Actually, we can just import them safely
    from app.physics.gpx_parser import parse_gpx
    from app.physics.pipeline import compute_ride, RideParams
    from app.physics.metrics import summarize
    from app.api.analyze import fetch_elevation_for_df, fetch_location, downsample
    import pandas as pd
    import numpy as np
    from fastapi.responses import JSONResponse
    
    try:
        with open(ride.gpx_file_path, "rb") as f:
            content = f.read()
            
        df = parse_gpx(content)
        
        if getattr(ride, "aux_gpx_file_path", None) and os.path.exists(ride.aux_gpx_file_path):
            with open(ride.aux_gpx_file_path, "rb") as f_aux:
                aux_content = f_aux.read()
            try:
                df_aux = parse_gpx(aux_content)
                df = augment_elevation_from_aux(df, df_aux)
            except Exception:
                pass
        
        is_external_ele = False
        if (df["ele"] == 0.0).all():
            df = await fetch_elevation_for_df(df)
            is_external_ele = True
            
        # We need params. Since we only saved riding_position in DB, we'll use defaults for the rest, 
        # or we could have saved them all. For now, use defaults + saved position.
        params = RideParams(
            rider_kg=75.0,
            bike_kg=10.0,
            tires="commuter",
            position=ride.riding_position,
            drivetrain="average",
            ele_smooth_s=60 if is_external_ele else 7
        )
            
        computed_df = compute_ride(df, params)
        summary = summarize(computed_df)
        summary["device"] = df.attrs.get("creator", "Unknown Device")
        
        # Add rider username for profile linking
        user = db.query(User).filter(User.id == ride.user_id).first()
        summary["rider_username"] = user.username if user else "Unknown"
        summary["name"] = os.path.basename(ride.gpx_file_path) if ride.gpx_file_path else ride.name
        if ride.aux_gpx_file_path:
            summary["aux_name"] = os.path.basename(ride.aux_gpx_file_path)
        
        loc = await fetch_location(computed_df["lat"].iloc[0], computed_df["lon"].iloc[0])
        summary["location"] = loc
        
        computed_df["time_s"] = computed_df["dt_s"].cumsum()
        computed_df["dist_diff"] = computed_df["distance_m"].diff().fillna(0.0)
        
        sampled_df = downsample(computed_df)
        
        points = []
        last_point = None
        for row in sampled_df.itertuples():
            if last_point is not None and row.time_s - last_point["time_s"] > 10.0:
                points.append({
                    "time_s": float(row.time_s - 1.0),
                    "distance": float(last_point["distance"]),
                    "elevation": float(last_point["elevation"]),
                    "speed": 0.0,
                    "power": 0.0,
                    "gradient": float(last_point["gradient"]),
                    "lat": float(last_point["lat"]),
                    "lon": float(last_point["lon"])
                })
                
            p = {
                "time_s": float(row.time_s),
                "distance": float(row.distance_m) / 1000.0,
                "elevation": float(row.ele_smooth),
                "speed": float(row.speed_ms) * 3.6,
                "power": float(row.power_w),
                "gradient": float(row.gradient),
                "lat": float(row.lat),
                "lon": float(row.lon)
            }
            if hasattr(row, "hr") and pd.notnull(row.hr): p["hr"] = float(row.hr)
            if hasattr(row, "cad") and pd.notnull(row.cad): p["cad"] = float(row.cad)
            points.append(p)
            last_point = p
            
        moving = computed_df["speed_ms"] > 0.5
        power_vals = computed_df.loc[moving, "power_w"].dropna()
        speed_vals = computed_df.loc[moving, "speed_ms"].dropna() * 3.6
        dt_vals = computed_df.loc[moving, "dt_s"].clip(upper=10.0).dropna()
        dist_vals = computed_df.loc[moving, "dist_diff"].dropna() / 1000.0
        
        histograms = {}
        
        def build_dynamic_histogram(vals, weights, is_power=True, is_time=True):
            if vals.empty: return []
            val_max = vals.max()
            if is_power:
                step = 50 if val_max > 500 else (20 if val_max > 250 else 10)
            else:
                step = 5 if val_max > 40 else (2 if val_max > 20 else 1)
            bins = np.arange(0, val_max + step, step)
            hist, _ = np.histogram(vals, bins=bins, weights=weights)
            threshold = 0.01 * weights.sum()
            res = []
            for i, count in enumerate(hist):
                if count >= threshold:
                    val = float(count) / 60.0 if is_time else float(count)
                    res.append({"bin": f"{int(bins[i])}-{int(bins[i+1])}", "count": val})
            return res
            
        histograms["power_time"] = build_dynamic_histogram(power_vals, dt_vals, is_power=True, is_time=True)
        histograms["power_dist"] = build_dynamic_histogram(power_vals, dist_vals, is_power=True, is_time=False)
        histograms["speed_time"] = build_dynamic_histogram(speed_vals, dt_vals, is_power=False, is_time=True)
        histograms["speed_dist"] = build_dynamic_histogram(speed_vals, dist_vals, is_power=False, is_time=False)
        
        if "hr" in computed_df.columns:
            hr_data = computed_df.loc[moving, ["hr", "dt_s"]].dropna(subset=["hr"])
            def build_hr_histogram(vals, weights):
                if vals.empty: return []
                bins = np.arange(0, vals.max() + 10, 10)
                hist, _ = np.histogram(vals, bins=bins, weights=weights)
                threshold = 0.01 * weights.sum()
                res = []
                for i, count in enumerate(hist):
                    if count >= threshold:
                        res.append({"bin": f"{int(bins[i])}-{int(bins[i+1])}", "count": float(count) / 60.0})
                return res
            histograms["hr_time"] = build_hr_histogram(hr_data["hr"], hr_data["dt_s"].clip(upper=10.0))

        response_data = {
            "summary": summary,
            "params": params.dict() if hasattr(params, 'dict') else vars(params),
            "points": points,
            "histograms": histograms
        }
        
        # Save to cache
        ride.analysis_cache = json.dumps(response_data)
        ride.analysis_version = CURRENT_ANALYSIS_VERSION
        db.commit()

        return JSONResponse(content=response_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ReanalyzeRequest(BaseModel):
    rider_kg: float
    bike_kg: float
    tires: str
    position: str
    drivetrain: str

@router.post("/{ride_id}/reanalyze")
async def reanalyze_existing_ride(ride_id: int, payload: ReanalyzeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ride = db.query(Ride).filter(Ride.id == ride_id, Ride.user_id == current_user.id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found or not owned by you")
        
    if not ride.gpx_file_path or not os.path.exists(ride.gpx_file_path):
        raise HTTPException(status_code=404, detail="GPX file missing from storage")
        
    # Update position in DB
    ride.riding_position = payload.position
    
    from app.physics.gpx_parser import parse_gpx
    from app.physics.pipeline import compute_ride, RideParams
    from app.physics.metrics import summarize
    from app.api.analyze import fetch_elevation_for_df, fetch_location, downsample
    import pandas as pd
    import numpy as np
    
    try:
        with open(ride.gpx_file_path, "rb") as f:
            content = f.read()
            
        df = parse_gpx(content)
        
        if getattr(ride, "aux_gpx_file_path", None) and os.path.exists(ride.aux_gpx_file_path):
            with open(ride.aux_gpx_file_path, "rb") as f_aux:
                aux_content = f_aux.read()
            try:
                df_aux = parse_gpx(aux_content)
                df = augment_elevation_from_aux(df, df_aux)
            except Exception:
                pass
        
        is_external_ele = False
        if (df["ele"] == 0.0).all():
            df = await fetch_elevation_for_df(df)
            is_external_ele = True
            
        params = RideParams(
            rider_kg=payload.rider_kg,
            bike_kg=payload.bike_kg,
            tires=payload.tires,
            position=payload.position,
            drivetrain=payload.drivetrain,
            ele_smooth_s=60 if is_external_ele else 7
        )
            
        computed_df = compute_ride(df, params)
        summary = summarize(computed_df)
        summary["device"] = df.attrs.get("creator", "Unknown Device")
        
        user = db.query(User).filter(User.id == ride.user_id).first()
        summary["rider_username"] = user.username if user else "Unknown"
        summary["name"] = os.path.basename(ride.gpx_file_path) if ride.gpx_file_path else ride.name
        
        loc = await fetch_location(computed_df["lat"].iloc[0], computed_df["lon"].iloc[0])
        summary["location"] = loc
        
        # Update summary stats in DB
        ride.avg_power_watts = summary["avg_power_w"]
        ride.normalized_power_watts = summary["normalized_power_w"]
        ride.total_work_kj = summary["total_work_kj"]
        ride.distance_km = summary["distance_km"]
        ride.moving_time_s = summary["moving_time_s"]
        ride.location = summary["location"]
        
        computed_df["time_s"] = computed_df["dt_s"].cumsum()
        computed_df["dist_diff"] = computed_df["distance_m"].diff().fillna(0.0)
        
        sampled_df = downsample(computed_df)
        
        points = []
        last_point = None
        for row in sampled_df.itertuples():
            if last_point is not None and row.time_s - last_point["time_s"] > 10.0:
                points.append({
                    "time_s": float(row.time_s - 1.0),
                    "distance": float(last_point["distance"]),
                    "elevation": float(last_point["elevation"]),
                    "speed": 0.0,
                    "power": 0.0,
                    "gradient": float(last_point["gradient"]),
                    "lat": float(last_point["lat"]),
                    "lon": float(last_point["lon"])
                })
            p = {
                "time_s": float(row.time_s),
                "distance": float(row.distance_m) / 1000.0,
                "elevation": float(row.ele_smooth),
                "speed": float(row.speed_ms) * 3.6,
                "power": float(row.power_w),
                "gradient": float(row.gradient),
                "lat": float(row.lat),
                "lon": float(row.lon)
            }
            if hasattr(row, "hr") and pd.notnull(row.hr): p["hr"] = float(row.hr)
            if hasattr(row, "cad") and pd.notnull(row.cad): p["cad"] = float(row.cad)
            points.append(p)
            last_point = p
            
        moving = computed_df["speed_ms"] > 0.5
        power_vals = computed_df.loc[moving, "power_w"].dropna()
        speed_vals = computed_df.loc[moving, "speed_ms"].dropna() * 3.6
        dt_vals = computed_df.loc[moving, "dt_s"].clip(upper=10.0).dropna()
        dist_vals = computed_df.loc[moving, "dist_diff"].dropna() / 1000.0
        
        histograms = {}
        def build_dynamic_histogram(vals, weights, is_power=True, is_time=True):
            if vals.empty: return []
            val_max = vals.max()
            if is_power:
                step = 50 if val_max > 500 else (20 if val_max > 250 else 10)
            else:
                step = 5 if val_max > 40 else (2 if val_max > 20 else 1)
            bins = np.arange(0, val_max + step, step)
            hist, _ = np.histogram(vals, bins=bins, weights=weights)
            threshold = 0.01 * weights.sum()
            res = []
            for i, count in enumerate(hist):
                if count >= threshold:
                    val = float(count) / 60.0 if is_time else float(count)
                    res.append({"bin": f"{int(bins[i])}-{int(bins[i+1])}", "count": val})
            return res
            
        histograms["power_time"] = build_dynamic_histogram(power_vals, dt_vals, is_power=True, is_time=True)
        histograms["power_dist"] = build_dynamic_histogram(power_vals, dist_vals, is_power=True, is_time=False)
        histograms["speed_time"] = build_dynamic_histogram(speed_vals, dt_vals, is_power=False, is_time=True)
        histograms["speed_dist"] = build_dynamic_histogram(speed_vals, dist_vals, is_power=False, is_time=False)
        
        if "hr" in computed_df.columns:
            hr_data = computed_df.loc[moving, ["hr", "dt_s"]].dropna(subset=["hr"])
            def build_hr_histogram(vals, weights):
                if vals.empty: return []
                bins = np.arange(0, vals.max() + 10, 10)
                hist, _ = np.histogram(vals, bins=bins, weights=weights)
                threshold = 0.01 * weights.sum()
                res = []
                for i, count in enumerate(hist):
                    if count >= threshold:
                        res.append({"bin": f"{int(bins[i])}-{int(bins[i+1])}", "count": float(count) / 60.0})
                return res
            histograms["hr_time"] = build_hr_histogram(hr_data["hr"], hr_data["dt_s"].clip(upper=10.0))

        response_data = {
            "summary": summary,
            "params": params.dict() if hasattr(params, 'dict') else vars(params),
            "points": points,
            "histograms": histograms
        }
        
        ride.analysis_cache = json.dumps(response_data)
        ride.analysis_version = CURRENT_ANALYSIS_VERSION
        db.commit()

        return response_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

