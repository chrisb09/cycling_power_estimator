from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import analyze, auth
from app.db.database import engine, Base

# Create all database tables (if they don't exist yet)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Cycling Power Estimator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(analyze.router, prefix="/api", tags=["analyze"])

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
