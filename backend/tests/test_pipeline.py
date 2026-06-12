"""Closed-form validation of the physics pipeline on synthetic tracks."""

from __future__ import annotations

import math

import numpy as np
import pytest

from app.physics import RideParams, compute_ride
from app.physics.constants import G, air_density

PARAMS = RideParams(rider_kg=75.0, bike_kg=10.0, tires="commuter",
                    position="hoods", drivetrain="average")
MASS = PARAMS.total_mass


def steady_state(df, frac=0.2):
    """Middle portion of a ride, away from rolling-window edge effects."""
    n = len(df)
    return df.iloc[int(n * frac): int(n * (1 - frac))]


def test_flat_constant_speed_matches_closed_form(flat_track):
    v = 8.333
    ride = compute_ride(flat_track, PARAMS)
    mid = steady_state(ride)

    rho = air_density(100.0)
    expected = (MASS * G * v * PARAMS.crr + 0.5 * rho * PARAMS.cda * v**3) / PARAMS.efficiency

    assert mid["speed_ms"].mean() == pytest.approx(v, rel=0.01)
    assert mid["gradient"].abs().max() < 0.005
    assert mid["power_w"].mean() == pytest.approx(expected, rel=0.03)


def test_climb_gravity_dominates(climb_track):
    v, g = 5.0, 0.05
    ride = compute_ride(climb_track, PARAMS)
    mid = steady_state(ride)

    theta = math.atan(g)
    rho = air_density(mid["ele_smooth"].mean())
    expected = (
        MASS * G * v * math.sin(theta)
        + MASS * G * v * math.cos(theta) * PARAMS.crr
        + 0.5 * rho * PARAMS.cda * v**3
    ) / PARAMS.efficiency

    assert mid["gradient"].mean() == pytest.approx(g, rel=0.05)
    assert mid["power_w"].mean() == pytest.approx(expected, rel=0.03)
    # gravity must be the dominant component on a 5% climb
    assert mid["p_gravity"].mean() > mid["p_aero"].mean()
    assert mid["p_gravity"].mean() > mid["p_rolling"].mean()


def test_stationary_yields_zero_power(stationary_track):
    ride = compute_ride(stationary_track, PARAMS)
    assert (ride["power_w"] == 0.0).all()
    assert (ride["speed_ms"] == 0.0).all()


def test_no_nan_or_inf_anywhere(flat_track, climb_track, stationary_track):
    for track in (flat_track, climb_track, stationary_track):
        ride = compute_ride(track, PARAMS)
        numeric = ride.select_dtypes(include=[np.number])
        assert np.isfinite(numeric.to_numpy()).all()


def test_negative_power_clamped():
    # steep descent: total power demand is negative -> clamped to 0
    from .conftest import make_track
    descent = make_track(speed_ms=12.0, gradient=-0.08)
    ride = compute_ride(descent, PARAMS)
    mid = steady_state(ride)
    assert (mid["power_w"] == 0.0).all()


def test_invalid_params_rejected():
    with pytest.raises(ValueError):
        RideParams(tires="moon-tires")
    with pytest.raises(ValueError):
        RideParams(position="superman")
    with pytest.raises(ValueError):
        RideParams(rider_kg=-1)


def test_gradient_clipped_on_gps_spike(flat_track):
    spiked = flat_track.copy()
    spiked.loc[150, "ele"] += 40.0  # absurd 40 m jump in 1 s
    ride = compute_ride(spiked, PARAMS)
    assert ride["gradient"].abs().max() <= 0.25 + 1e-9


def test_acceleration_clipped_on_gps_jump(flat_track):
    from app.physics.pipeline import MAX_ACCEL_MS2

    jumped = flat_track.copy()
    # teleport the rider ~90 m north at one sample -> huge speed/accel spike
    jumped.loc[150:, "lat"] += 90.0 / 111_194.9
    ride = compute_ride(jumped, PARAMS)
    assert ride["accel_ms2"].abs().max() <= MAX_ACCEL_MS2 + 1e-9
