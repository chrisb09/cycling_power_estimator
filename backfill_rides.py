import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/backend")

from app.db.database import SessionLocal
from app.db.models import Ride
from app.physics.gpx_parser import parse_gpx
from app.physics.pipeline import compute_ride, RideParams
from app.physics.metrics import summarize
from app.api.analyze import fetch_location, fetch_elevation_for_df
import asyncio
import pandas as pd

async def backfill():
    db = SessionLocal()
    rides = db.query(Ride).filter((Ride.distance_km == None) | (Ride.moving_time_s == None)).all()
    print(f"Found {len(rides)} rides to backfill.")
    
    for ride in rides:
        if not ride.gpx_file_path or not os.path.exists(ride.gpx_file_path):
            continue
            
        with open(ride.gpx_file_path, "rb") as f:
            content = f.read()
            
        try:
            df = parse_gpx(content)
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
            
            ride.distance_km = summary["distance_km"]
            ride.moving_time_s = summary["moving_time_s"]
            
            if not ride.location:
                try:
                    loc = await fetch_location(computed_df["lat"].iloc[0], computed_df["lon"].iloc[0])
                    ride.location = loc
                except:
                    ride.location = "Unknown Location"
                    
            db.commit()
            print(f"Backfilled ride {ride.id}")
        except Exception as e:
            print(f"Failed to backfill {ride.id}: {e}")
            
if __name__ == "__main__":
    asyncio.run(backfill())
