import pandas as pd
from app.physics.gpx_parser import parse_gpx
import numpy as np

df = parse_gpx("../Outdoor_cycling.gpx")
df['dt_s'] = df['time'].diff().dt.total_seconds().fillna(1.0)
df['dist'] = df.apply(lambda r: r.name, axis=1) # dummy
# let's just use the pipeline functions directly
from app.physics.pipeline import haversine_m
seg = haversine_m(df['lat'].shift(), df['lon'].shift(), df['lat'], df['lon'])
df['seg'] = seg
df['raw_speed'] = seg / df['dt_s']
print(df[['time', 'dt_s', 'seg', 'raw_speed']][110:125].to_string())
