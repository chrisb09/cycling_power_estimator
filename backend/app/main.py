from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.api import analyze, auth, bikes, rides, admin
from app.db.database import engine, Base

# Create all database tables (if they don't exist yet)
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.api.admin import ADMIN_CODE
    print("\n" + "="*50)
    print(f"ADMIN CODE FOR SELF-PROMOTION: {ADMIN_CODE}")
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

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(bikes.router, prefix="/api/bikes", tags=["bikes"])
app.include_router(rides.router, prefix="/api/rides", tags=["rides"])
app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
