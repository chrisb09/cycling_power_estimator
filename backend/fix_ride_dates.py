import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.db.models import Ride
from app.physics.gpx_parser import parse_gpx

def fix_dates():
    db = SessionLocal()
    rides = db.query(Ride).all()
    print(f"Checking {len(rides)} rides...")
    
    for ride in rides:
        if not ride.gpx_file_path or not os.path.exists(ride.gpx_file_path):
            continue
            
        with open(ride.gpx_file_path, "rb") as f:
            content = f.read()
            
        try:
            df = parse_gpx(content)
            ride_date = df["time"].iloc[0].to_pydatetime()
            if ride.date != ride_date:
                ride.date = ride_date
                db.commit()
                print(f"Fixed date for ride {ride.id} to {ride_date}")
        except Exception as e:
            print(f"Failed to fix ride {ride.id}: {e}")

if __name__ == "__main__":
    fix_dates()
