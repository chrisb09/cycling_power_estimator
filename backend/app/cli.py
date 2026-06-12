"""CLI entry point: estimate cycling power from a GPX file.

Usage:
    python -m app.cli RIDE.gpx --rider-kg 75 --bike-kg 10 \
        --tires commuter --position hoods --drivetrain average
"""

from __future__ import annotations

import argparse
import json
import sys

from .physics import CDA, CRR, DRIVETRAIN, RideParams, compute_ride, parse_gpx, summarize
from .physics.metrics import format_duration


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="cycling-power-estimator",
        description="Estimate cycling power output (watts) from a GPX file.",
    )
    p.add_argument("gpx_file", help="path to the GPX file")
    p.add_argument("--rider-kg", type=float, default=75.0, help="rider mass in kg")
    p.add_argument("--bike-kg", type=float, default=10.0, help="bike mass in kg")
    p.add_argument("--tires", choices=sorted(CRR), default="commuter")
    p.add_argument("--position", choices=sorted(CDA), default="hoods")
    p.add_argument("--drivetrain", choices=sorted(DRIVETRAIN), default="average")
    p.add_argument("--ele-smooth", type=int, default=5, metavar="S",
                   help="elevation smoothing window in seconds (default 5)")
    p.add_argument("--speed-smooth", type=int, default=3, metavar="S",
                   help="speed smoothing window in seconds (default 3)")
    p.add_argument("--csv", metavar="PATH", help="write per-point data to CSV")
    p.add_argument("--json", metavar="PATH", help="write summary stats to JSON")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    params = RideParams(
        rider_kg=args.rider_kg,
        bike_kg=args.bike_kg,
        tires=args.tires,
        position=args.position,
        drivetrain=args.drivetrain,
        ele_smooth_s=args.ele_smooth,
        speed_smooth_s=args.speed_smooth,
    )

    try:
        df = parse_gpx(args.gpx_file)
    except (OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    ride = compute_ride(df, params)
    stats = summarize(ride)

    print()
    print("=" * 52)
    print("  CYCLING POWER ESTIMATE")
    print("=" * 52)
    print(f"  File:            {args.gpx_file}")
    print(f"  Points:          {len(ride)}")
    print(f"  Rider + bike:    {params.rider_kg:.1f} + {params.bike_kg:.1f} kg")
    print(f"  Tires/position:  {params.tires} (Crr={params.crr}), "
          f"{params.position} (CdA={params.cda})")
    print(f"  Drivetrain eff:  {params.efficiency:.2f} ({args.drivetrain})")
    print("-" * 52)
    print(f"  Distance:        {stats['distance_km']:.2f} km")
    print(f"  Elapsed time:    {format_duration(stats['elapsed_time_s'])}")
    print(f"  Moving time:     {format_duration(stats['moving_time_s'])}")
    print(f"  Avg speed:       {stats['avg_speed_kmh']:.1f} km/h "
          f"(max {stats['max_speed_kmh']:.1f})")
    print(f"  Elevation:       +{stats['elevation_gain_m']:.0f} m gain "
          f"({stats['elevation_min_m']:.0f}-{stats['elevation_max_m']:.0f} m)")
    print("-" * 52)
    print(f"  Avg power:       {stats['avg_power_w']:.0f} W (moving)")
    print(f"  Normalized pwr:  {stats['normalized_power_w']:.0f} W")
    print(f"  Peak power (5s): {stats['max_power_w']:.0f} W")
    print(f"  Total work:      {stats['total_work_kj']:.0f} kJ")
    print("=" * 52)
    print()

    if args.csv:
        cols = [
            "time", "distance_m", "ele_smooth", "speed_ms", "gradient",
            "p_gravity", "p_rolling", "p_aero", "p_kinetic", "power_w",
        ]
        ride[cols].to_csv(args.csv, index=False)
        print(f"per-point data written to {args.csv}")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(stats, fh, indent=2)
        print(f"summary written to {args.json}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
