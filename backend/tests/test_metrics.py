"""Tests for summary metrics."""

from __future__ import annotations

import pandas as pd
import pytest

from app.physics import RideParams, compute_ride, summarize
from app.physics.metrics import format_duration, normalized_power, peak_power

PARAMS = RideParams()


def test_peak_power_suppresses_single_spike():
    power = pd.Series([200.0] * 600)
    power.iloc[300] = 5000.0  # single-sample artifact
    dt = pd.Series([1.0] * 600)
    # best 5s average: (4*200 + 5000)/5 = 1160, far below the raw spike
    assert peak_power(power, dt) == pytest.approx(1160.0)


def test_np_equals_avg_for_constant_power():
    power = pd.Series([200.0] * 600)
    dt = pd.Series([1.0] * 600)
    assert normalized_power(power, dt) == pytest.approx(200.0)


def test_np_exceeds_avg_for_variable_power():
    power = pd.Series(([100.0] * 60 + [400.0] * 60) * 5)
    dt = pd.Series([1.0] * len(power))
    assert normalized_power(power, dt) > power.mean()


def test_summary_work_integration(flat_track):
    ride = compute_ride(flat_track, PARAMS)
    stats = summarize(ride)
    # total work must equal integral of power over time
    expected_kj = (ride["power_w"] * ride["dt_s"]).sum() / 1000.0
    assert stats["total_work_kj"] == pytest.approx(expected_kj)
    assert stats["moving_time_s"] <= stats["elapsed_time_s"]
    assert stats["distance_km"] == pytest.approx(299 * 8.333 / 1000.0, rel=0.01)


def test_summary_stationary(stationary_track):
    ride = compute_ride(stationary_track, PARAMS)
    stats = summarize(ride)
    assert stats["moving_time_s"] == 0.0
    assert stats["avg_power_w"] == 0.0
    assert stats["total_work_kj"] == 0.0


def test_format_duration():
    assert format_duration(0) == "0:00:00"
    assert format_duration(3725) == "1:02:05"
