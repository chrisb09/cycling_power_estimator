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
    role = Column(String, default="user") # 'admin', 'user'
    is_active = Column(Integer, default=1) # 1 for active, 0 for disabled
    default_ride_visibility = Column(String, default="private") # 'private', 'unlisted', 'public'
    profile_visibility = Column(String, default="public") # 'private', 'internal', 'public'
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    location = Column(String, nullable=True)
    profile_picture = Column(String, nullable=True)

    bikes = relationship("Bike", back_populates="owner")
    rides = relationship("Ride", back_populates="rider")
    collections = relationship("Collection", back_populates="owner")

class InviteKey(Base):
    __tablename__ = "invite_keys"

    key = Column(String, primary_key=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    used_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_used = Column(Integer, default=0)

    creator = relationship("User", foreign_keys=[created_by])
    user = relationship("User", foreign_keys=[used_by])

class Bike(Base):
    __tablename__ = "bikes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    weight_kg = Column(Float, default=10.0)
    tire_type = Column(String, default="commuter") # 'slick', 'commuter', 'gravel', 'mtb'
    drivetrain_efficiency = Column(Float, default=0.95) # e.g. 0.97, 0.95, 0.92
    default_riding_position = Column(String, nullable=True) # 'tops', 'hoods', 'drops', 'aero'
    drivetrain = Column(String, default="average") # 'optimized', 'average', 'dirty'

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
    aux_gpx_file_path = Column(String, nullable=True)
    riding_position = Column(String, default="hoods") # 'tops', 'hoods', 'drops', 'aero'
    visibility = Column(String, default="private") # 'private', 'unlisted', 'public'
    share_token = Column(String, nullable=True, unique=True, index=True)
    analysis_version = Column(Integer, default=1)
    analysis_cache = Column(String, nullable=True) # JSON dump of the analysis result
    
    # Snapshot of physical parameters used during analysis
    rider_kg = Column(Float, default=75.0, nullable=True)
    bike_kg = Column(Float, default=10.0)
    tires = Column(String, default="commuter")
    drivetrain = Column(String, default="average")

    # Pre-computed summary stats
    avg_power_watts = Column(Float)
    normalized_power_watts = Column(Float)
    total_work_kj = Column(Float)
    distance_km = Column(Float)
    moving_time_s = Column(Float)
    location = Column(String)

    rider = relationship("User", back_populates="rides")
    bike = relationship("Bike", back_populates="rides")
    collections = relationship("CollectionRide", back_populates="ride")


class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    visibility = Column(String, default="private")
    share_token = Column(String, nullable=True, unique=True, index=True)

    owner = relationship("User", back_populates="collections")
    rides = relationship("CollectionRide", back_populates="collection", cascade="all, delete-orphan")


class CollectionRide(Base):
    __tablename__ = "collection_rides"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("collections.id"))
    ride_id = Column(Integer, ForeignKey("rides.id"))
    position = Column(Integer, default=0)

    collection = relationship("Collection", back_populates="rides")
    ride = relationship("Ride", back_populates="collections")
