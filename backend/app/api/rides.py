from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime
from app.db.database import get_db
from app.db.models import Ride, User
from app.api.auth import get_current_user
import os

router = APIRouter()

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
    
    import os
    if ride.gpx_file_path and os.path.exists(ride.gpx_file_path):
        try:
            os.remove(ride.gpx_file_path)
        except Exception:
            pass
            
    db.delete(ride)
    db.commit()
    return {"status": "success"}

class RideRenameRequest(BaseModel):
    name: str

@router.patch("/{ride_id}")
def rename_ride(ride_id: int, payload: RideRenameRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ride = db.query(Ride).filter(Ride.id == ride_id, Ride.user_id == current_user.id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
        
    ride.name = payload.name
    db.commit()
    return {"status": "success", "name": ride.name}

@router.get("/{ride_id}/analyze")
async def analyze_saved_ride(ride_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ride = db.query(Ride).filter(Ride.id == ride_id, Ride.user_id == current_user.id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
        
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
        
        # We need params. Since we only saved riding_position in DB, we'll use defaults for the rest, 
        # or we could have saved them all. For now, use defaults + saved position.
        params = RideParams(
            rider_kg=75.0,
            bike_kg=10.0,
            tires="commuter",
            position=ride.riding_position,
            drivetrain="average"
        )
        
        if (df["ele"] == 0.0).all():
            df = await fetch_elevation_for_df(df)
            
        computed_df = compute_ride(df, params)
        summary = summarize(computed_df)
        summary["device"] = df.attrs.get("creator", "Unknown Device")
        
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

        return JSONResponse(content={
            "summary": summary,
            "params": params.dict() if hasattr(params, 'dict') else vars(params),
            "points": points,
            "histograms": histograms
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

