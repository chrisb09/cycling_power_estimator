#!/usr/bin/env python3
"""One-off migration: import the local account, rides and all GPX tracks into
the deployed server's persistent data volume.

Usage:
    backend/.venv/bin/python scripts/import_rides.py --dry-run
    backend/.venv/bin/python scripts/import_rides.py
"""

from __future__ import annotations

import argparse
import io
import json
import math
import re
import shutil
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "backend"))

from app.physics.gpx_parser import parse_gpx  # noqa: E402
from app.physics.pipeline import RideParams, compute_ride, haversine_m  # noqa: E402
from app.physics.metrics import summarize  # noqa: E402

LOCAL_DB = REPO / "backend" / "cycling_power.db"
NEXTCLOUD = Path("/home/christian/Nextcloud/tmp")
STORAGE = REPO / "backend" / "storage" / "gpx"
SERVER = "root@192.168.1.205"
REMOTE_BASE = "/container/data/cycling_power_estimator"
STAGE = Path("/tmp/opencode/import_stage")
ELEV_CACHE_FILE = STAGE / "elevation_cache.json"

RIDER_KG, BIKE_KG = 73.5, 10.0
TIRES, POSITION, DRIVETRAIN = "commuter", "hoods", "average"

# Each session: one ride on the server. `aux` is a second recording of the
# same ride — in practice the Zepp track has heart rate but no elevation and
# the Komoot/Garmin track has elevation, so we merge elevation into the HR
# track exactly like the app's augment_elevation_from_aux().
SESSIONS = [
    {"name": "Rundtour über Lemiers", "primary": "Fahrradtour-3.gpx"},
    {"name": "Rundtour über Partij", "primary": "Fahrradtour-2.gpx"},
    {"name": "Nach Gulpen und zurück", "primary": "Nach_Gulpen.gpx"},
    {"name": "Rundtour über Gulpen-Wittem", "primary": "Fahrradtour-1.gpx"},
    {"name": "Rundtour über Margraten", "primary": "storage:11508a58-bf69-46da-84aa-9baf5c149eba_Zepp20260607143852.gpx",
     "aux": "Outdoor_cycling.gpx"},
    {"name": "Rundtour über Cadier en Keer", "primary": "storage:dd11d8f0-fa75-4cb9-b98b-98b3dc5ad0fa_Zepp20260613203707.gpx",
     "aux": "storage:dd11d8f0-fa75-4cb9-b98b-98b3dc5ad0fa_aux_Fahrradtour.gpx"},
    {"name": "Von Vaals nach Maastricht und zurück", "primary": "Outdoor_cycling-2.gpx"},
    {"name": "Von Süchteln nach Venlo", "primary": "Zepp20260627163720.gpx"},
    {"name": "Von Deurne nach Loosdrecht", "primary": "Zepp20260627205055.gpx"},
    {"name": "Rundtour über Houten", "primary": "Zepp20260628124016.gpx", "aux": "Fahrradtour-6.gpx"},
    {"name": "Von Loosdrecht nach Hilversum", "primary": "Fahrradtour-7.gpx"},
    {"name": "Kurze Runde bei Loosdrecht", "primary": "Zepp20260630123920.gpx"},
    {"name": "Nach Hilversum und zurück", "primary": "Zepp20260630174106.gpx"},
    {"name": "Von Loosdrecht nach Utrecht", "primary": "Zepp20260702094742.gpx", "aux": "Outdoor_cycling-4.gpx"},
    {"name": "Von Den Haag nach Loosdrecht", "primary": "Zepp20260702114431.gpx"},
    {"name": "Von Loosdrecht nach Utrecht", "primary": "Zepp20260704110206.gpx"},
    {"name": "Von Maastricht nach Vaals", "primary": "Zepp20260704140807.gpx"},
    # Later additions from the Nextcloud tmp folder (August 2026). Each has a
    # second recording of the same ride; the Outdoor_cycling track is used
    # because it has more points / finer elevation detail.
    {"name": "Nach Gulpen und zurück", "primary": "Outdoor_cycling-9.gpx", "batch": "august"},
    {"name": "Rundtour über Cadier en Keer", "primary": "Outdoor_cycling-8.gpx", "batch": "august"},
    {"name": "Von Vaals nach Kerpen", "primary": "Von_Vaals_nach_Kerpen.gpx", "batch": "august"},
    {"name": "Von Kerpen nach Vaals", "primary": "Von_Kerpen_nach_Vaals.gpx", "batch": "august"},
]


def source_path(ref: str) -> Path:
    if ref.startswith("storage:"):
        return STORAGE / ref[len("storage:"):]
    for base in (NEXTCLOUD / "Gpx", NEXTCLOUD):
        p = base / ref
        if p.exists():
            return p
    raise FileNotFoundError(ref)


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def remote(cmd: str) -> None:
    run(["ssh", SERVER, cmd])


def has_real_elevation(df) -> bool:
    return (df["ele"].abs() > 0.01).any()


def merge_elevation(primary, aux):
    """Copy elevation from aux onto primary, nearest match by time (+ distance)."""
    t_p = primary["time"].astype("int64").to_numpy() / 1e9
    t_a = aux["time"].astype("int64").to_numpy() / 1e9
    if len(t_a) == 0:
        return primary
    idx = np.searchsorted(t_a, t_p)
    elevations = np.zeros(len(primary))
    for i, j in enumerate(idx):
        cand = [k for k in (j - 1, j) if 0 <= k < len(t_a)]
        if not cand:
            continue
        best = min(cand, key=lambda k: abs(t_a[k] - t_p[i]))
        elevations[i] = aux["ele"].iloc[best]
    primary = primary.copy()
    primary["ele"] = elevations
    return primary


TILE_CACHE: dict[tuple, Image.Image] = {}


def terrain_elevation(lat: float, lon: float, z: int = 12) -> float:
    """Elevation from the free AWS Terrarium DEM tiles used by the 3D view."""
    n = 2 ** z
    xf = (lon + 180.0) / 360.0 * n
    yf = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
    tx, ty = int(xf), int(yf)
    px = min(255, int((xf - tx) * 256))
    py = min(255, int((yf - ty) * 256))
    key = (z, tx, ty)
    if key not in TILE_CACHE:
        url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{tx}/{ty}.png"
        try:
            with urllib.request.urlopen(url, timeout=20) as response:
                TILE_CACHE[key] = Image.open(io.BytesIO(response.read())).convert("RGB")
        except Exception as exc:
            print(f"    terrain tile failed ({exc}); using 0 m", file=sys.stderr)
            return 0.0
    r, g, b = TILE_CACHE[key].getpixel((px, py))
    return r * 256 + g + b / 256 - 32768


def fetch_elevation(df, cache: dict) -> tuple:
    """Fill elevation from the Terrarium DEM, caching by coordinate."""
    keys = [f"{lat:.5f},{lon:.5f}" for lat, lon in zip(df["lat"], df["lon"])]
    values = [cache.get(k) for k in keys]
    missing = [i for i, v in enumerate(values) if v is None]
    for i in missing:
        values[i] = terrain_elevation(float(df["lat"].iloc[i]), float(df["lon"].iloc[i]))
        cache[keys[i]] = values[i]
    df = df.copy()
    df["ele"] = values
    return df


def inject_elevation(path: Path, cache: dict) -> bytes:
    """Write DEM elevation into a GPX that originally had none, so the app can
    recompute the ride without calling a flaky external elevation API."""
    raw = path.read_bytes()

    def repl(m):
        lat, lon = float(m.group(1)), float(m.group(2))
        val = cache.get(f"{lat:.5f},{lon:.5f}", 0.0)
        gt = m.group(0).index(b">") + 1
        return m.group(0)[:gt] + f"<ele>{val:.2f}</ele>".encode() + m.group(0)[gt:]

    return re.sub(rb'<trkpt lat="([-\d.]+)" lon="([-\d.]+)">\s*<time>', repl, raw)


def fetch_location(lat: float, lon: float) -> str:
    url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=10"
    req = urllib.request.Request(url, headers={"User-Agent": "PowerEstimator/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            addr = json.loads(response.read().decode()).get("address", {})
        parts = [addr.get(k) for k in ("city", "town", "village", "county", "state", "country")]
        return ", ".join(p for p in parts if p) or "Unknown Location"
    except Exception:
        return "Unknown Location"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--append", action="store_true",
                        help="only import the batch of rides marked 'august' (no user insert)")
    args = parser.parse_args()

    sessions = [s for s in SESSIONS if (s.get("batch") == "august") == args.append]

    STAGE.mkdir(parents=True, exist_ok=True)
    gpx_stage = STAGE / "gpx"
    if gpx_stage.exists():
        for old in gpx_stage.iterdir():
            old.unlink()
    else:
        gpx_stage.mkdir()
    cache = json.loads(ELEV_CACHE_FILE.read_text()) if ELEV_CACHE_FILE.exists() else {}

    # --- read local account ---
    local = sqlite3.connect(LOCAL_DB)
    local.row_factory = sqlite3.Row
    user = dict(local.execute("SELECT * FROM users WHERE username = 'christian'").fetchone())
    local.close()

    # --- download live server DB ---
    db_copy = STAGE / "cycling_power.db"
    run(["scp", f"{SERVER}:{REMOTE_BASE}/cycling_power.db", str(db_copy)])
    con = sqlite3.connect(db_copy)
    con.row_factory = sqlite3.Row
    existing_user = con.execute("SELECT id FROM users WHERE username = 'christian'").fetchone()
    if existing_user:
        if not args.append:
            print("ERROR: user 'christian' already exists on server; refusing to duplicate", file=sys.stderr)
            return 1
        user_id = existing_user["id"]
    else:
        user_id = user["id"]
        user_cols = list(user.keys())
        con.execute(
            f"INSERT INTO users ({','.join(user_cols)}) VALUES ({','.join('?' * len(user_cols))})",
            [user[c] for c in user_cols],
        )

    print(f"{'name':<30}{'date':<12}{'pts':>6}{'ele':>5}{'W':>5}{'NP':>5}{'kJ':>6}  files")
    for session in sessions:
        primary_path = source_path(session["primary"])
        df = parse_gpx(primary_path)
        aux_path = source_path(session["aux"]) if session.get("aux") else None
        external = False
        aux_name = None

        if aux_path:
            aux = parse_gpx(aux_path)
            if not has_real_elevation(df) and has_real_elevation(aux):
                df = merge_elevation(df, aux)
            aux_name = aux_path.name

        if not has_real_elevation(df):
            df = fetch_elevation(df, cache)
            external = True

        params = RideParams(
            rider_kg=RIDER_KG, bike_kg=BIKE_KG, tires=TIRES,
            position=POSITION, drivetrain=DRIVETRAIN,
            ele_smooth_s=60 if external else 7,
        )
        ride = compute_ride(df, params)
        stats = summarize(ride)

        ride_id = str(uuid.uuid4())
        primary_name = f"{ride_id}_{primary_path.name}"
        if external:
            (gpx_stage / primary_name).write_bytes(inject_elevation(primary_path, cache))
        else:
            shutil.copyfile(primary_path, gpx_stage / primary_name)
        aux_db_path = None
        if aux_name:
            aux_stored = f"{ride_id}_aux_{aux_name}"
            shutil.copyfile(aux_path, gpx_stage / aux_stored)
            aux_db_path = f"/app/data/storage/gpx/{aux_stored}"

        gpx_db_path = f"/app/data/storage/gpx/{primary_name}"
        date = df["time"].iloc[0].to_pydatetime().replace(tzinfo=None)
        location = fetch_location(float(df["lat"].iloc[0]), float(df["lon"].iloc[0]))

        con.execute(
            """INSERT INTO rides
               (user_id, name, date, gpx_file_path, aux_gpx_file_path, riding_position,
                visibility, analysis_version, analysis_cache, rider_kg, bike_kg,
                tires, drivetrain, avg_power_watts, normalized_power_watts,
                total_work_kj, distance_km, moving_time_s, location)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                user_id, session["name"], date.isoformat(sep=" "), gpx_db_path, aux_db_path, POSITION,
                "private", 0, None, RIDER_KG, BIKE_KG, TIRES, DRIVETRAIN,
                stats["avg_power_w"], stats["normalized_power_w"], stats["total_work_kj"],
                stats["distance_km"], stats["moving_time_s"], location,
            ),
        )
        print(
            f"{session['name']:<30}{str(date)[:10]:<12}{len(df):>6}"
            f"{'aux' if aux_path else '   ':>5}{stats['avg_power_w']:>5.0f}"
            f"{stats['normalized_power_w']:>5.0f}{stats['total_work_kj']:>6.0f}"
            f"  {primary_path.name}" + (f" + {aux_name}" if aux_name else "")
        )

    con.commit()
    con.close()
    ELEV_CACHE_FILE.write_text(json.dumps(cache))

    pic = REPO / "backend" / "app" / "uploads" / "profiles" / "1_e68e6ec5.jpg"
    if pic.exists():
        (STAGE / "profiles").mkdir(exist_ok=True)
        shutil.copyfile(pic, STAGE / "profiles" / pic.name)

    if args.dry_run:
        print("\nDRY RUN: nothing uploaded")
        return 0

    print("\nUploading database, GPX files and profile picture...")
    remote(f"docker stop power-estimator-backend >/dev/null")
    run(["scp", str(db_copy), f"{SERVER}:{REMOTE_BASE}/cycling_power.db"])
    run(["scp", *(str(p) for p in sorted(gpx_stage.glob("*"))),
         f"{SERVER}:{REMOTE_BASE}/storage/gpx/"])
    if pic.exists():
        run(["scp", str(STAGE / "profiles" / pic.name),
             f"{SERVER}:{REMOTE_BASE}/uploads/profiles/"])
    remote("docker start power-estimator-backend >/dev/null")
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
