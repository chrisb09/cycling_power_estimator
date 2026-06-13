from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    weight_kg = Column(Float, default=75.0)
    height_cm = Column(Float, default=175.0)

    bikes = relationship("Bike", back_populates="owner")
    rides = relationship("Ride", back_populates="rider")

class Bike(Base):
    __tablename__ = "bikes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    weight_kg = Column(Float, default=10.0)
    tire_type = Column(String, default="commuter") # 'slick', 'commuter', 'gravel', 'mtb'
    drivetrain_efficiency = Column(Float, default=0.95) # e.g. 0.97, 0.95, 0.92

    owner = relationship("User", back_populates="bikes")
    rides = relationship("Ride", back_populates="bike")

class Ride(Base):
    __tablename__ = "rides"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    bike_id = Column(Integer, ForeignKey("bikes.id"))
    name = Column(String)
    date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    gpx_file_path = Column(String)
    riding_position = Column(String, default="hoods") # 'tops', 'hoods', 'drops', 'aero'
    
    # Pre-computed summary stats
    avg_power_watts = Column(Float)
    normalized_power_watts = Column(Float)
    total_work_kj = Column(Float)
    distance_km = Column(Float)
    moving_time_s = Column(Float)
    location = Column(String)

    rider = relationship("User", back_populates="rides")
    bike = relationship("Bike", back_populates="rides")
