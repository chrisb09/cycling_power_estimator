"""Tests for GPX parsing using a synthetic file and the real ride."""

from __future__ import annotations

import io
from pathlib import Path

import pytest

from app.physics import parse_gpx

REAL_GPX = Path(__file__).resolve().parents[2] / "Outdoor_cycling.gpx"

MINI_GPX = """<?xml version='1.0' encoding='UTF-8'?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="50.0" lon="6.0"><ele>100.0</ele><time>2026-01-01T10:00:00Z</time></trkpt>
    <trkpt lat="50.0001" lon="6.0"><ele>100.5</ele><time>2026-01-01T10:00:01Z</time></trkpt>
    <trkpt lat="50.0002" lon="6.0"><ele>101.0</ele><time>2026-01-01T10:00:02Z</time></trkpt>
    <trkpt lat="50.0003" lon="6.0"><ele>101.5</ele></trkpt>
  </trkseg></trk>
</gpx>
"""


def test_parse_minimal_gpx():
    df = parse_gpx(io.StringIO(MINI_GPX))
    # point without <time> is dropped
    assert len(df) == 3
    assert list(df.columns) == ["time", "lat", "lon", "ele"]
    assert df["time"].is_monotonic_increasing
    assert df["ele"].iloc[0] == 100.0


def test_parse_empty_raises():
    empty = MINI_GPX.split("<trkseg>")[0] + "<trkseg></trkseg></trk></gpx>"
    with pytest.raises(ValueError):
        parse_gpx(io.StringIO(empty))


@pytest.mark.skipif(not REAL_GPX.exists(), reason="sample ride not present")
def test_parse_real_ride():
    df = parse_gpx(REAL_GPX)
    assert len(df) > 5000
    assert df["time"].is_monotonic_increasing
    assert df["ele"].between(0, 1000).all()
    assert df["lat"].between(50, 51).all()
