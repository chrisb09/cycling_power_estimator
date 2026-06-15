from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.api import analyze, auth, bikes, rides, admin
from app.db.database import engine, Base

# Create all database tables (if they don't exist yet)
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.api.admin import ADMIN_CODE, NUKE_CODE
    print("\n" + "="*50)
    print(f"ADMIN CODE FOR SELF-PROMOTION: {ADMIN_CODE}")
    print(f"NUKE CODE TO WIPE DB: {NUKE_CODE}")
    print("="*50 + "\n")
    yield

app = FastAPI(title="Cycling Power Estimator", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads", "profiles")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads/profiles", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(bikes.router, prefix="/api/bikes", tags=["bikes"])
app.include_router(rides.router, prefix="/api/rides", tags=["rides"])
app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])

import socket
import tomllib

def get_version():
    try:
        pyproject_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "pyproject.toml")
        with open(pyproject_path, "rb") as f:
            data = tomllib.load(f)
            return data.get("project", {}).get("version", "0.1.0")
    except Exception:
        return "0.1.0"

APP_VERSION = get_version()

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "version": APP_VERSION,
        "hostname": socket.gethostname()
    }
