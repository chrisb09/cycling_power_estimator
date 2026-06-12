from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import analyze

app = FastAPI(title="Cycling Power Estimator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router, prefix="/api", tags=["analyze"])

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
