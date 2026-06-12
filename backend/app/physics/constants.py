"""Physical constants and lookup tables for the power model."""

from __future__ import annotations

import numpy as np

G = 9.81  # gravitational acceleration, m/s^2
AIR_DENSITY_SEA_LEVEL = 1.225  # kg/m^3 at 15 degrees C
SCALE_HEIGHT_M = 8500.0  # atmospheric scale height for density correction

# Rolling resistance coefficient (Crr) by tire type
CRR = {
    "slick": 0.004,
    "commuter": 0.006,
    "gravel": 0.010,
    "mtb": 0.014,
}

# Effective frontal area * drag coefficient (CdA, m^2) by riding position
CDA = {
    "tops": 0.40,
    "hoods": 0.36,
    "drops": 0.31,
    "aero": 0.25,
}

# Drivetrain efficiency by maintenance state
DRIVETRAIN = {
    "optimized": 0.97,
    "average": 0.95,
    "dirty": 0.92,
}


def air_density(elevation_m):
    """Approximate air density at elevation (isothermal barometric model).

    Accepts scalars or numpy arrays.
    """
    return AIR_DENSITY_SEA_LEVEL * np.exp(-np.asarray(elevation_m, dtype=float) / SCALE_HEIGHT_M)
