"""Shared test fixtures: synthetic GPX track builders."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pytest

T0 = datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
M_PER_DEG_LAT = 111_194.9  # meters per degree latitude (R=6371km)


def make_track(
    speed_ms: float,
    n: int = 300,
    gradient: float = 0.0,
    start_ele: float = 100.0,
) -> pd.DataFrame:
    """Build a synthetic constant-speed track heading due north at 1 Hz."""
    t = [T0 + timedelta(seconds=i) for i in range(n)]
    dist = np.arange(n) * speed_ms
    lat = 50.0 + dist / M_PER_DEG_LAT
    lon = np.full(n, 6.0)
    ele = start_ele + dist * gradient
    return pd.DataFrame({"time": pd.to_datetime(t), "lat": lat, "lon": lon, "ele": ele})


@pytest.fixture
def flat_track():
    return make_track(speed_ms=8.333)  # 30 km/h flat


@pytest.fixture
def climb_track():
    return make_track(speed_ms=5.0, gradient=0.05)  # 5% climb at 18 km/h


@pytest.fixture
def stationary_track():
    return make_track(speed_ms=0.0, n=120)
