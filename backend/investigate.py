import pandas as pd
from app.physics.gpx_parser import parse_gpx
from app.physics.pipeline import compute_ride, RideParams

df = parse_gpx("../Outdoor_cycling.gpx")
params = RideParams()
res = compute_ride(df, params)
spike = res[(res['distance_m'] > 200) & (res['distance_m'] < 500)].sort_values('power_w', ascending=False).head(5)
print(spike[['time', 'distance_m', 'dt_s', 'speed_ms', 'accel_ms2', 'gradient', 'p_gravity', 'p_rolling', 'p_aero', 'p_kinetic', 'power_w']].to_string())
