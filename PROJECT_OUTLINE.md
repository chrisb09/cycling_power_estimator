# PROJECT: CYCLING POWER ESTIMATOR & 3D VISUALIZER
# TECHNICAL SPECIFICATION & ARCHITECTURE PLAN

================================================================================
PART 1: INTRODUCTION & PROJECT GOALS
================================================================================

WHAT WE ARE DOING:
We are building a web-based, open-source platform that analyzes GPS track data
(GPX files) to retroactively calculate a cyclist's power output (watts) across
a completed ride. The platform will combine mathematical physics modeling with
interactive 2D data charting and immersive 3D terrain visualization.

THE POINT / GOAL:
Physical power meters are expensive and inaccessible to many amateur cyclists.
However, standard GPX files inherently contain the necessary physical variables
(time, distance, and elevation) to calculate the work done. The goal of this
project is to:
1. Democratize cycling analytics by reverse-engineering power output accurately
   without hardware power meters.
2. Provide an educational and engaging visual breakdown of exactly where a rider
   expended the most energy.
3. Serve as a central hub where users can store their biological data, bike
   profiles, and historical ride metrics.

================================================================================
PART 2: RECOMMENDED TECH STACK
================================================================================

- BACKEND / MATH ENGINE: Python (FastAPI or Flask)
  Why: Python's data science libraries (Pandas, NumPy) are the industry standard
  for handling time-series data, calculating rolling averages, and computing
  derivatives (speed/acceleration) from GPS coordinate arrays.

- DATABASE: SQLite3 (via SQLAlchemy ORM)
  Why: Lightweight, requires no separate server setup, and perfectly handles
  relational data for a small-to-medium user base.

- FRONTEND UI: React.js
  Why: Component-based state management makes it easy to swap between user
  profiles, bike loadouts, and different ride visualizations dynamically.

- 2D VISUALIZATION: Chart.js or Recharts
  Why: Excellent for synchronized multi-axis line charts (Speed, Power, Elevation).

- 3D VISUALIZATION: Mapbox GL JS (or MapLibre GL JS) + Turf.js
  Why: Mapbox natively supports 3D digital elevation models (DEM) directly in
  the browser. Turf.js will handle the geospatial math required to animate a
  virtual bike along the GPX path.

================================================================================
PART 3: DATABASE ARCHITECTURE
================================================================================

1. USERS TABLE
   - id (Primary Key)
   - username, password_hash
   - weight_kg (Rider mass)
   - height_cm (Used to calculate baseline frontal surface area)

2. BIKES TABLE
   - id (PK), user_id (Foreign Key)
   - bike_name
   - weight_kg (Bike mass)
   - tire_type (Enum: Slick, Commuter, Gravel, MTB -> Maps to Crr friction coeff)
   - drivetrain_efficiency (Enum: Optimized (0.97), Average (0.95), Dirty (0.92))

3. RIDES TABLE
   - id (PK), user_id (FK), bike_id (FK)
   - ride_name, date
   - gpx_file_path (Pointer to local file storage)
   - riding_position (Enum: Tops, Hoods, Drops, Aero -> Maps to CdA aero modifier)
   - avg_power_watts, normalized_power_watts, total_work_kj

================================================================================
PART 4: PHYSICS & MATH PIPELINE
================================================================================

STEP 1: VARIABLE ASSIGNMENT
Fetch the User's weight, the Bike's weight, and predefined constants for Rolling
Resistance (Crr) and Aerodynamic Drag (CdA) based on their database selections.

STEP 2: GPX PARSING & SMOOTHING (Backend)
- Extract: Time, Latitude, Longitude, Elevation for each trackpoint.
- Smooth: Apply a 3-to-5 second rolling average to elevation to remove GPS noise.
- Compute: Use the Haversine formula to calculate distance between coordinates.
- Derive: Calculate Speed (dD/dt), Acceleration (dS/dt), and Gradient (dE/dD).

STEP 3: POWER CALCULATION
Apply the fundamental cycling power equation to every point:
P_total = (P_gravity + P_rolling + P_aero + P_kinetic) / Drivetrain_Efficiency
- P_gravity = Mass * 9.81 * Speed * sin(Gradient)
- P_rolling = Mass * 9.81 * Speed * cos(Gradient) * Crr
- P_aero = 0.5 * Air_Density * CdA * Speed^3
- P_kinetic = Mass * Speed * Acceleration

================================================================================
PART 5: VISUALIZATION STRATEGY
================================================================================

THE 2D DASHBOARD:
- Output a unified JSON array from the backend to the frontend.
- Plot distance on the X-axis.
- Plot three layered Y-axes: Elevation profile (shaded background), Speed line,
  and Power output line. Include summary stats (Mean Watts, Total kJ).

THE 3D TERRAIN RENDERER:
- Initialize Mapbox GL JS with the `raster-dem` source to generate 3D mountains.
- Convert the GPX path into a GeoJSON LineString.
- Color-code the LineString (e.g., Red = >400W, Green = <150W).
- Use Turf.js `turf.along()` in a requestAnimationFrame loop to animate a marker
  (the virtual cyclist) tracing the route over the 3D topography.

================================================================================
PART 6: DEVELOPMENT PHASES
================================================================================

PHASE 1: Core Physics Engine (Local Python CLI)
Focus purely on writing a script that parses a GPX file, runs the physics
equations, handles data smoothing, and outputs realistic wattage numbers.

PHASE 2: API & Web Dashboard
Wrap the Python script in a FastAPI backend. Build a basic React frontend to
upload GPX files, enter variables manually, and plot the 2D Chart.js graphs.

PHASE 3: Persistence & User State
Implement the SQLite database. Add user authentication, save profiles, and allow
users to store multiple bikes and past rides.

PHASE 4: The 3D Engine
Integrate Mapbox/MapLibre and Turf.js to render the final 3D visualizer and
ride playback animation.
