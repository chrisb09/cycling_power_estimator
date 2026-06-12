# Cycling Power Estimator & 3D Visualizer — Plan & Progress

## Overview

A web-based platform analyzing GPX track data to retroactively calculate cycling power output (watts), combining physics modeling with 2D charts and 3D terrain visualization.

- **Test data**: `Outdoor_cycling.gpx` — Komoot export, ~36 km, 1:52 elapsed, 5,702 trackpoints at 1 Hz (Aachen, Germany)
- **Stack**: Python (FastAPI) + SQLite + React (Vite) + Recharts + MapLibre GL JS

---

## Phase 1 — Core Physics Engine (CLI) — ✅ COMPLETE

### Files

| File | Purpose |
|------|---------|
| `backend/app/physics/constants.py` | Lookup tables: Crr (tire→0.004–0.014), CdA (position→0.25–0.40), drivetrain efficiency (0.92–0.97), air density w/ altitude correction |
| `backend/app/physics/gpx_parser.py` | gpxpy → pandas DataFrame (time, lat, lon, ele); drops points w/o time/elevation; sorts + deduplicates by time |
| `backend/app/physics/pipeline.py` | `RideParams` dataclass + `compute_ride()`: elevation smoothing (5s median→mean), haversine distance, speed despiking (median→mean 3s), acceleration (±2 m/s² clamp), gradient (±25% clip), 4-component power equation |
| `backend/app/physics/metrics.py` | `summarize()` → distance, avg/NP/5s-peak power, total kJ, elevation gain; `normalized_power()`, `peak_power()` |
| `backend/app/physics/__init__.py` | Public API exports |
| `backend/app/cli.py` | `python -m app.cli GPX [--rider-kg] [--bike-kg] [--tires] [--position] [--drivetrain] [--csv] [--json]` |
| `backend/tests/conftest.py` | `make_track()` synthetic GPX builder + fixtures (flat 30 km/h, 5% climb, stationary) |
| `backend/tests/test_parser.py` | Parse minimal GPX, empty GPX, real ride |
| `backend/tests/test_pipeline.py` | Closed-form power checks (flat, climb), stationary→0, no NaN, negative clamp, invalid params, gradient/accel clipping |
| `backend/tests/test_metrics.py` | NP = avg for constant power, NP > avg for variable, work integration, peak 5s suppresses single-sample spike |

### Signal Processing Pipeline

```
GPX → parse → 5s median→mean ele → haversine dist → 3s median→mean speed
    → speed clamped ≥0.5 m/s → accel via diff → accel clipped ±2 m/s²
    → gradient Δele/Δdist → clipped ±25% → P_grav + P_roll + P_aero + P_kin
    → / η → clamp ≥0 → stationary=0 → per-point DataFrame
```

### Power Equation (per trackpoint)

```
P_total = max(0, (P_grav + P_roll + P_aero + P_kin) / η)

P_grav  = m·g·v·sin(atan(gradient))
P_roll  = m·g·v·cos(atan(gradient))·Crr
P_aero  = 0.5·ρ(h)·CdA·v³
P_kin   = m·v·a

ρ(h) = 1.225 · exp(-h / 8500)
```

### Validation Results (`Outdoor_cycling.gpx`, defaults: 75 kg + 10 kg, commuter tires, hoods)

| Metric | Value |
|--------|-------|
| Distance | 36.07 km |
| Moving time | 1:47:45 |
| Avg speed | 20.1 km/h (max 47.7) |
| Elevation gain | +282 m (92–198 m) |
| Avg power | 125 W |
| Normalized Power | 167 W |
| Peak power (5s) | 1,138 W |
| Total work | 807 kJ |

### Parameter Sensitivity

| Configuration | Avg W | NP | kJ |
|--------------|-------|-----|-----|
| Defaults (commuter/hoods) | 125 | 167 | 807 |
| Slick tires | 116 | 158 | 750 |
| Aero position | 109 | 152 | 702 |
| MTB tires + tops | 169 | 210 | 1,091 |
| 90 kg rider | 137 | 187 | 887 |

**Tests**: 17 pass, synthetic closed-form matches within 3%.

---

## Phase 2 — FastAPI + React Dashboard — ✅ COMPLETE

### Backend
- `POST /api/analyze` — multipart GPX upload + params → summary + downsampled point series
- Downsampling to ~1,000 points (distance-bucketed, preserving power extremes and stationary pauses)
- `GET /api/health`
- CORS configured

### Frontend
- Vite + React + Recharts
- Upload form with parameter inputs (kg, tires, position, drivetrain)
- ComposedChart: elevation area + speed line + power line, dual Y-axes, mobile-responsive smart smoothing
- Stat cards & Histograms: distance, moving time, avg/NP/peak power, kJ, elevation gain, distribution charts

### Deployment
- Docker containerization (`docker-compose up -d`)
- Multi-stage Node.js (Vite + Nginx Reverse Proxy)
- Python FastAPI backend

---

## Phase 3 — Persistence & Auth — 🔜 NEXT

- SQLite via SQLAlchemy: Users, Bikes, Rides tables per spec
- JWT auth (bcrypt + PyJWT): register, login, protected routes
- CRUD endpoints for bikes, rides (GPX stored to disk, summary cached)
- Frontend: login/register pages, profile editor, bike manager, ride history

---

## Phase 4 — 3D Visualizer — 📋 PLANNED

- MapLibre GL JS + free AWS Terrarium DEM tiles (no API key)
- `setTerrain()` with hillshade + sky + pitched camera
- Power-colored route overlay (green <150 W → yellow → red >400 W)
- Turf.js playback animation: `turf.along()` in `requestAnimationFrame` loop
- Play/pause/speed controls, synced to 2D chart crosshair

---

## Architecture

```
backend/                    Python FastAPI
├── app/
│   ├── cli.py              Phase 1 CLI
│   ├── main.py             Phase 2 FastAPI app
│   ├── api/                Phase 2+3 routes
│   ├── physics/            Phase 1 physics engine (framework-free)
│   ├── db/                 Phase 3 SQLAlchemy models
│   └── auth.py             Phase 3 JWT
├── storage/gpx/            Uploaded GPX files
└── tests/                  pytest

frontend/                   Vite + React
├── src/
│   ├── api/                Fetch client
│   ├── components/         UploadForm, RideChart, StatsSummary, Map3D, auth, bikes...
│   └── App.jsx
```

## Dependencies

- **Python**: `gpxpy`, `pandas`, `numpy`, `fastapi`, `uvicorn`, `python-multipart`, `sqlalchemy`, `passlib[bcrypt]`, `pyjwt` (Phase 3)
- **JS**: `react`, `recharts`, `maplibre-gl`, `@turf/turf` (Phase 4)
