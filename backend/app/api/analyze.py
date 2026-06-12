from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
import numpy as np
import pandas as pd
import urllib.request
import json
import asyncio
from typing import Optional

from app.physics.gpx_parser import parse_gpx
from app.physics.pipeline import compute_ride, RideParams, haversine_m
from app.physics.metrics import summarize

router = APIRouter()

def downsample(df: pd.DataFrame, target: int = 1000) -> pd.DataFrame:
    """Downsample a DataFrame to ~target points, preserving power extremes."""
    if len(df) <= target:
        return df
    
    window = len(df) // target
    df = df.copy()
    df["bucket"] = np.arange(len(df)) // window
    
    # We want to preserve max power in each bucket, but take mean/last for other metrics
    agg_dict = {
        "time_s": "last",
        "distance_m": "last",
        "ele_smooth": "mean",
        "speed_ms": "mean",
        "power_w": "mean",
        "gradient": "mean",
        "lat": "mean",
        "lon": "mean"
    }
    
    if "hr" in df.columns: agg_dict["hr"] = "mean"
    if "cad" in df.columns: agg_dict["cad"] = "mean"

    res = df.groupby("bucket").agg(agg_dict).reset_index(drop=True)
    
    return res

def fetch_location_sync(lat, lon):
    url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=10"
    req = urllib.request.Request(url, headers={'User-Agent': 'PowerEstimator/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=3.0) as response:
            data = json.loads(response.read().decode())
            addr = data.get("address", {})
            city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county")
            state = addr.get("state")
            country = addr.get("country")
            parts = [p for p in [city, state, country] if p]
            return ", ".join(parts) if parts else "Unknown Location"
    except Exception:
        return "Unknown Location"

async def fetch_location(lat, lon):
    return await asyncio.to_thread(fetch_location_sync, lat, lon)

def fetch_elevation_sync(df):
    url = "https://api.open-elevation.com/api/v1/lookup"
    # To avoid payload being too massive, we could chunk it, but Open-Elevation handles 10k fine
    # Let's chunk it into 5000 max just to be completely safe
    chunk_size = 5000
    elevations = []
    
    for i in range(0, len(df), chunk_size):
        chunk = df.iloc[i:i+chunk_size]
        locs = [{"latitude": row.lat, "longitude": row.lon} for _, row in chunk.iterrows()]
        data = json.dumps({"locations": locs}).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json', 'Accept': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=30.0) as response:
                res = json.loads(response.read().decode())
                elevations.extend([r["elevation"] for r in res.get("results", [])])
        except Exception as e:
            # Fallback on failure
            elevations.extend([0.0] * len(chunk))
            
    if len(elevations) == len(df):
        df["ele"] = elevations
    return df

async def fetch_elevation_for_df(df):
    return await asyncio.to_thread(fetch_elevation_sync, df)

def augment_elevation_from_aux(df_primary, df_aux):
    # If the primary already has elevation, no need
    if not (df_primary["ele"] == 0.0).all():
        return df_primary

    # Extract numpy arrays
    t_p = df_primary["time"].astype("int64").to_numpy() / 1e9
    lat_p = df_primary["lat"].to_numpy()
    lon_p = df_primary["lon"].to_numpy()
    
    t_a = df_aux["time"].astype("int64").to_numpy() / 1e9
    lat_a = df_aux["lat"].to_numpy()
    lon_a = df_aux["lon"].to_numpy()
    ele_a = df_aux["ele"].to_numpy()
    
    elevations = np.zeros(len(df_primary))
    for i in range(len(df_primary)):
        dist_m = haversine_m(lat_p[i], lon_p[i], lat_a, lon_a)
        dt_s = t_a - t_p[i]
        norm_sq = dist_m**2 + dt_s**2
        best_idx = np.argmin(norm_sq)
        elevations[i] = ele_a[best_idx]
        
    df_primary["ele"] = elevations
    return df_primary

@router.post("/analyze")
async def analyze_ride(
    file: UploadFile = File(...),
    aux_file: Optional[UploadFile] = File(None),
    rider_kg: float = Form(75.0),
    bike_kg: float = Form(10.0),
    tires: str = Form("commuter"),
    position: str = Form("hoods"),
    drivetrain: str = Form("average")
):
    if not file.filename.endswith(".gpx"):
        raise HTTPException(status_code=400, detail="File must be a GPX file")
    
    content = await file.read()
    
    try:
        params = RideParams(
            rider_kg=rider_kg,
            bike_kg=bike_kg,
            tires=tires,
            position=position,
            drivetrain=drivetrain
        )
        df = parse_gpx(content)
        
        # If aux file is provided, use it to augment elevation
        if aux_file is not None and aux_file.filename and aux_file.filename.endswith(".gpx"):
            aux_content = await aux_file.read()
            try:
                df_aux = parse_gpx(aux_content)
                df = augment_elevation_from_aux(df, df_aux)
            except Exception:
                pass
        
        # If elevation is still missing entirely, augment it via Open-Elevation API
        if (df["ele"] == 0.0).all():
            df = await fetch_elevation_for_df(df)
            
        computed_df = compute_ride(df, params)
        summary = summarize(computed_df)
        
        # Pass device from GPX
        summary["device"] = df.attrs.get("creator", "Unknown Device")
        
        # Get start location
        loc = await fetch_location(computed_df["lat"].iloc[0], computed_df["lon"].iloc[0])
        summary["location"] = loc
        
        # Add cumulative time for frontend tooltips
        computed_df["time_s"] = computed_df["dt_s"].cumsum()
        computed_df["dist_diff"] = computed_df["distance_m"].diff().fillna(0.0)
        
        # Downsample for frontend
        sampled_df = downsample(computed_df)
        
        # Prepare points for JSON
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
                "speed": float(row.speed_ms) * 3.6, # km/h
                "power": float(row.power_w),
                "gradient": float(row.gradient),
                "lat": float(row.lat),
                "lon": float(row.lon)
            }
            if hasattr(row, "hr") and pd.notnull(row.hr): p["hr"] = float(row.hr)
            if hasattr(row, "cad") and pd.notnull(row.cad): p["cad"] = float(row.cad)
            
            # Interpolate a pause flatline if needed
            points.append(p)
            last_point = p
            
        # Compute histograms for non-zero speeds
        moving = computed_df["speed_ms"] > 0.5
        power_vals = computed_df.loc[moving, "power_w"].dropna()
        speed_vals = computed_df.loc[moving, "speed_ms"].dropna() * 3.6
        dt_vals = computed_df.loc[moving, "dt_s"].clip(upper=10.0).dropna()
        dist_vals = computed_df.loc[moving, "dist_diff"].dropna() / 1000.0 # km
        
        histograms = {}
        
        def build_dynamic_histogram(vals, weights, is_power=True, is_time=True):
            if vals.empty: return []
            val_max = vals.max()
            
            if is_power:
                rng = val_max
                step = 50 if rng > 500 else (20 if rng > 250 else 10)
            else:
                rng = val_max
                step = 5 if rng > 40 else (2 if rng > 20 else 1)
                
            bins = np.arange(0, val_max + step, step)
            hist, _ = np.histogram(vals, bins=bins, weights=weights)
            
            total_w = weights.sum()
            threshold = 0.01 * total_w  # 1% threshold
            
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
            hr_vals = hr_data["hr"]
            hr_weights = hr_data["dt_s"].clip(upper=10.0)
            
            # For HR, step size of 10 is usually good
            def build_hr_histogram(vals, weights):
                if vals.empty: return []
                val_max = vals.max()
                bins = np.arange(0, val_max + 10, 10)
                hist, _ = np.histogram(vals, bins=bins, weights=weights)
                total_w = weights.sum()
                threshold = 0.01 * total_w
                res = []
                for i, count in enumerate(hist):
                    if count >= threshold:
                        res.append({"bin": f"{int(bins[i])}-{int(bins[i+1])}", "count": float(count) / 60.0})
                return res
            histograms["hr_time"] = build_hr_histogram(hr_vals, hr_weights)

        return JSONResponse(content={
            "summary": summary,
            "params": params.dict() if hasattr(params, 'dict') else vars(params),
            "points": points,
            "histograms": histograms
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
