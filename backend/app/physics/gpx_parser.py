"""GPX file parsing into a pandas DataFrame."""

from __future__ import annotations

import io
from pathlib import Path
from typing import IO, Union

import gpxpy
import pandas as pd


def parse_gpx(source: Union[str, Path, IO, bytes]) -> pd.DataFrame:
    """Parse a GPX file into a DataFrame with columns: time, lat, lon, ele.

    Accepts a filesystem path, an open file object, or raw bytes.
    Points missing a timestamp or elevation are dropped. The result is
    sorted by time with exact-duplicate timestamps removed.
    """
    if isinstance(source, (str, Path)):
        with open(source, "r", encoding="utf-8") as fh:
            gpx = gpxpy.parse(fh)
    elif isinstance(source, bytes):
        gpx = gpxpy.parse(io.StringIO(source.decode("utf-8")))
    else:
        gpx = gpxpy.parse(source)

    records = []
    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                if point.time is None:
                    continue
                row = {
                    "time": point.time,
                    "lat": point.latitude,
                    "lon": point.longitude,
                    "ele": point.elevation if point.elevation is not None else 0.0,
                }
                
                # Parse extensions (e.g. Garmin TrackPointExtension for hr, cad, speed)
                for ext in point.extensions:
                    for child in ext:
                        tag_name = child.tag.split("}")[-1] # Remove namespace like {http://...}
                        if tag_name in ("hr", "cad", "speed"):
                            try:
                                row[tag_name] = float(child.text)
                            except (ValueError, TypeError):
                                pass
                
                records.append(row)

    if not records:
        raise ValueError("GPX file contains no usable trackpoints (need valid time records)")

    df = pd.DataFrame.from_records(records)
    df.attrs["creator"] = gpx.creator
    df["time"] = pd.to_datetime(df["time"], utc=True)
    df = df.sort_values("time").drop_duplicates(subset="time").reset_index(drop=True)
    return df
