"""Ride summary metrics computed from the physics pipeline output."""

from __future__ import annotations

import numpy as np
import pandas as pd

NP_WINDOW_S = 30  # Normalized Power rolling window
PEAK_WINDOW_S = 5  # peak power reported as best 5s average (suppresses GPS spikes)


def _window_samples(dt_s: pd.Series, seconds: int) -> int:
    dt_median = float(dt_s[dt_s > 0].median()) if (dt_s > 0).any() else 1.0
    return max(1, int(round(seconds / max(dt_median, 1e-9))))


def normalized_power(power: pd.Series, dt_s: pd.Series) -> float:
    """Normalized Power: 30s rolling avg -> 4th power -> mean -> 4th root."""
    win = _window_samples(dt_s, NP_WINDOW_S)
    rolled = power.rolling(win, min_periods=win).mean().dropna()
    if rolled.empty:
        rolled = power
    return float((rolled**4).mean() ** 0.25)


def peak_power(power: pd.Series, dt_s: pd.Series, seconds: int = PEAK_WINDOW_S) -> float:
    """Best sustained power over the given window (default 5s)."""
    win = _window_samples(dt_s, seconds)
    rolled = power.rolling(win, min_periods=win).mean().dropna()
    if rolled.empty:
        rolled = power
    return float(rolled.max())


def summarize(df: pd.DataFrame) -> dict:
    """Compute headline statistics from a compute_ride() DataFrame."""
    moving = df["speed_ms"] > 0.5 # 1.8 km/h threshold
    # Cap the dt_s to 10 seconds for moving time so huge pauses don't incorrectly add to moving time
    moving_time_s = float(df.loc[moving, "dt_s"].clip(upper=10.0).sum())
    elapsed_s = float(df["dt_s"].sum())
    distance_km = float(df["distance_m"].iloc[-1]) / 1000.0

    avg_speed_kmh = (
        (distance_km * 1000.0) / elapsed_s * 3.6 if elapsed_s > 0 else 0.0
    )
    avg_moving_speed_kmh = (
        (distance_km * 1000.0) / moving_time_s * 3.6 if moving_time_s > 0 else 0.0
    )
    avg_power_moving = (
        float(
            (df.loc[moving, "power_w"] * df.loc[moving, "dt_s"]).sum()
            / moving_time_s
        )
        if moving_time_s > 0
        else 0.0
    )
    total_work_kj = float((df["power_w"] * df["dt_s"]).sum() / 1000.0)

    ele_gain = float(df["ele_smooth"].diff().clip(lower=0).sum())
    ele_loss = float(df["ele_smooth"].diff().clip(upper=0).abs().sum())

    res = {
        "start_time": df["time"].iloc[0].isoformat() if "time" in df.columns else None,
        "end_time": df["time"].iloc[-1].isoformat() if "time" in df.columns else None,
        "distance_km": distance_km,
        "elapsed_time_s": elapsed_s,
        "moving_time_s": moving_time_s,
        "avg_speed_kmh": avg_speed_kmh,
        "avg_moving_speed_kmh": avg_moving_speed_kmh,
        "max_speed_kmh": float(df["speed_ms"].max() * 3.6),
        "avg_power_w": avg_power_moving,
        "normalized_power_w": normalized_power(df["power_w"], df["dt_s"]),
        "max_power_w": peak_power(df["power_w"], df["dt_s"]),
        "total_work_kj": total_work_kj,
        "total_work_kwh": total_work_kj / 3600.0,
        "energy_kcal": total_work_kj,  # 1 kJ of mechanical work roughly equals 1 kcal burned (20-25% human efficiency)
        "elevation_gain_m": ele_gain,
        "elevation_loss_m": ele_loss,
        "elevation_min_m": float(df["ele_smooth"].min()),
        "elevation_max_m": float(df["ele_smooth"].max()),
        "max_gradient_pct": float(df["gradient"].max() * 100),
        "min_gradient_pct": float(df["gradient"].min() * 100),
    }
    
    if "hr" in df.columns:
        res["avg_hr_bpm"] = float(df.loc[moving, "hr"].mean())
        res["max_hr_bpm"] = float(df["hr"].max())
        res["min_hr_bpm"] = float(df.loc[df["hr"] > 0, "hr"].min()) if (df["hr"] > 0).any() else 0.0
        
    if "cad" in df.columns:
        res["avg_cad_rpm"] = float(df.loc[moving, "cad"].mean())
        res["max_cad_rpm"] = float(df["cad"].max())
        
    return res


def format_duration(seconds: float) -> str:
    s = int(round(seconds))
    h, rem = divmod(s, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}"
