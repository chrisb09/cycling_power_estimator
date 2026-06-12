"""Core physics pipeline: smoothing, kinematics, and power computation."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .constants import CDA, CRR, DRIVETRAIN, G, air_density

EARTH_RADIUS_M = 6_371_000.0
STATIONARY_SPEED_MS = 1.2  # ~4.3 km/h (filters out red light GPS wander)
MAX_GRADIENT = 0.25  # clip gradients to +/- 25% to suppress GPS spikes
MAX_ACCEL_MS2 = 2.0  # clip acceleration to a physically plausible range


@dataclass(frozen=True)
class RideParams:
    """Rider, bike, and model configuration for a power computation."""

    rider_kg: float = 75.0
    bike_kg: float = 10.0
    tires: str = "commuter"
    position: str = "hoods"
    drivetrain: str = "average"
    ele_smooth_s: int = 7
    speed_smooth_s: int = 5

    def __post_init__(self) -> None:
        if self.tires not in CRR:
            raise ValueError(f"unknown tire type {self.tires!r}; choose from {sorted(CRR)}")
        if self.position not in CDA:
            raise ValueError(f"unknown position {self.position!r}; choose from {sorted(CDA)}")
        if self.drivetrain not in DRIVETRAIN:
            raise ValueError(
                f"unknown drivetrain {self.drivetrain!r}; choose from {sorted(DRIVETRAIN)}"
            )
        if self.rider_kg <= 0 or self.bike_kg <= 0:
            raise ValueError("rider_kg and bike_kg must be positive")

    @property
    def total_mass(self) -> float:
        return self.rider_kg + self.bike_kg

    @property
    def crr(self) -> float:
        return CRR[self.tires]

    @property
    def cda(self) -> float:
        return CDA[self.position]

    @property
    def efficiency(self) -> float:
        return DRIVETRAIN[self.drivetrain]


def haversine_m(lat1, lon1, lat2, lon2):
    """Vectorized haversine distance in meters."""
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2.0) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2.0) ** 2
    return 2.0 * EARTH_RADIUS_M * np.arcsin(np.sqrt(a))


def _rolling_window(dt_median: float, seconds: int) -> int:
    """Convert a time window in seconds to an odd number of samples."""
    n = max(1, int(round(seconds / max(dt_median, 1e-9))))
    return n if n % 2 == 1 else n + 1


def compute_ride(df: pd.DataFrame, params: RideParams) -> pd.DataFrame:
    """Compute kinematics and per-point power for a parsed GPX DataFrame.

    Input columns: time (tz-aware), lat, lon, ele.
    Output adds: dt_s, distance_m, speed_ms, accel_ms2, gradient,
    p_gravity, p_rolling, p_aero, p_kinetic, power_w.
    """
    if len(df) < 2:
        raise ValueError("need at least 2 trackpoints to compute a ride")

    out = df.copy().reset_index(drop=True)

    dt = out["time"].diff().dt.total_seconds()
    dt_median = float(dt.median())
    out["dt_s"] = dt.fillna(0.0)

    # Identify continuous segments (gap > 10s means new segment)
    segment_id = (out["dt_s"] > 10.0).cumsum()

    def _smooth(series: pd.Series, win: int, method: str = "mean") -> pd.Series:
        if method == "median":
            return series.groupby(segment_id, group_keys=False).transform(lambda x: x.rolling(win, center=True, min_periods=1).median())
        return series.groupby(segment_id, group_keys=False).transform(lambda x: x.rolling(win, center=True, min_periods=1).mean())

    # --- elevation smoothing: median (despike) then mean (smooth) ---
    win = _rolling_window(dt_median, params.ele_smooth_s)
    ele = _smooth(out["ele"], win, "median")
    ele = _smooth(ele, win, "mean")
    out["ele_smooth"] = ele

    # --- distance ---
    seg = haversine_m(
        out["lat"].shift(), out["lon"].shift(), out["lat"], out["lon"]
    )
    seg = pd.Series(seg, index=out.index).fillna(0.0)
    out["distance_m"] = seg.cumsum()

    # --- speed (despiked + smoothed), with stationary clamp ---
    if "speed" in out.columns:
        raw_speed = out["speed"].to_numpy()
    else:
        raw_speed = np.where(out["dt_s"] > 0, seg / out["dt_s"], 0.0)
        
    win_v = _rolling_window(dt_median, params.speed_smooth_s)
    
    speed = _smooth(pd.Series(raw_speed, index=out.index), win_v, "median")
    speed = _smooth(speed, win_v, "mean")
    speed = speed.where(speed >= STATIONARY_SPEED_MS, 0.0)
    out["speed_ms"] = speed

    # --- acceleration ---
    accel = speed.groupby(segment_id).diff() / out["dt_s"].replace(0.0, np.nan)
    accel = _smooth(accel, win_v, "mean").fillna(0.0)
    out["accel_ms2"] = accel.clip(-MAX_ACCEL_MS2, MAX_ACCEL_MS2)

    # --- gradient ---
    d_ele = ele.groupby(segment_id).diff()
    gradient = np.where(seg > 0.5, d_ele / seg, 0.0)
    gradient = np.clip(np.nan_to_num(gradient), -MAX_GRADIENT, MAX_GRADIENT)
    gradient = _smooth(pd.Series(gradient, index=out.index), win_v, "mean")
    out["gradient"] = gradient

    # --- power components ---
    m = params.total_mass
    theta = np.arctan(out["gradient"])
    v = out["speed_ms"]
    rho = air_density(out["ele_smooth"].to_numpy())

    out["p_gravity"] = m * G * v * np.sin(theta)
    out["p_rolling"] = m * G * v * np.cos(theta) * params.crr
    out["p_aero"] = 0.5 * rho * params.cda * v**3
    out["p_kinetic"] = (m * v * out["accel_ms2"]).clip(-1000.0, 1000.0)

    total = (
        out["p_gravity"] + out["p_rolling"] + out["p_aero"] + out["p_kinetic"]
    ) / params.efficiency
    # Negative totals mean braking/coasting: no pedal power required.
    out["power_w"] = total.clip(lower=0.0)
    # Stationary points produce exactly zero.
    out.loc[v <= 0.0, "power_w"] = 0.0
    
    # Final aesthetic smoothing for power (3 seconds)
    win_p = _rolling_window(dt_median, 3)
    out["power_w"] = _smooth(out["power_w"], win_p, "mean")

    return out
