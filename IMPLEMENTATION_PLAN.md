# Implementation Plan — Phase 3 Bug Fixes & New Features

## Overview

This document captures the agreed plan for fixing Phase 3 bugs and adding the
requested new features in the Cycling Power Estimator project. The plan is
organized into independently-shippable parts (A–F) plus a DB-migration part (G)
that supports them.

### Design decisions (confirmed with user)

- **Bike presets** populate the upload form fields (weight/tires/drivetrain/
  riding position). The user can still edit any populated value afterwards.
  No riding-position whitelist; the preset just supplies a *default* position.
- **Ride persistence** stores a **snapshot** of every physics param used at
  upload/analysis time (`bike_kg`, `rider_kg`, `tires`, `drivetrain`,
  `riding_position`). The ride also links to the chosen bike preset via
  `bike_id` if one was selected. Editing a bike preset later never retroactively
  changes past rides.
- **Collections** (ride groupings) — free grouping of any of the user's rides
  into a named Collection with description and `private` / `unlisted` / `public`
  visibility (same system as rides). Public collections are listed on the user's
  public profile alongside their public rides.
- **Combined Normalized Power** across a collection: pragmatic **time-weighted
  average of per-ride NP** (cached on each `Ride` row), labeled clearly as
  "Average Normalized Power (per-ride)". A true combined NP from concatenated
  per-second power data is intentionally NOT computed in v1.
- **Session expiry**: global 401 handler + proactive JWT `exp` check on app
  load and at expiry.
- **DB migration must preserve existing data** (~20 rides already in production).
  Migration runs **automatically on container start** in the Docker deployment
  (and in local dev) — see Part G.

---

## Part A — Bug: Upload saves wrong `bike_kg`, `visibility`, `name` ⬜ TODO

### Root causes

1. `frontend/src/api/client.js:191-205` — `analyzeRide` never appends
   `visibility` or `name` to the `FormData`.
2. `backend/app/api/analyze.py:198-212` — the `Ride(...)` constructor never sets
   `bike_kg`; it hardcodes `name` to the filename (`analyze.py:200`).
3. `backend/app/db/models.py:51-76` — `Ride` has no `bike_kg` column; `visibility`
   defaults to `"private"`, masking the missing-payload bug.
4. `backend/app/api/rides.py:219-228` — the saved-ride analysis path hardcodes
   `bike_kg=10.0, rider_kg=75.0, tires="commuter", drivetrain="average"`,
   so re-analysis uses defaults instead of what the user originally uploaded with.

### Changes

**Backend**

- `backend/app/db/models.py` — Add columns to `Ride`:
  - `rider_kg (Float, default=75.0, nullable=True)`
  - `bike_kg  (Float, default=10.0)`
  - `tires    (String, default="commuter")`
  - `drivetrain (String, default="average")`
  - (existing `bike_id` already present)
- `backend/app/api/analyze.py`
  - Add `name: Optional[str] = Form(None)` to the endpoint signature.
  - Add `bike_id: Optional[int] = Form(None)` (see Part B).
  - In the `Ride(...)` constructor persist:
    `name = name or file.filename.replace(".gpx","")`,
    `bike_kg=`, `rider_kg=`, `tires=`, `drivetrain=`, and `bike_id=` (if provided).
- `backend/app/api/rides.py:219-228` (and the reanalyze-for-update path around
  line 387) — Replace hardcoded `75.0 / 10.0 / "commuter" / "average"` with
  values saved on the ride row; allow the request payload to override.
- `backend/app/api/rides.py RideUpdateRequest` — Add optional fields
  `bike_kg`, `tires`, `drivetrain`, `rider_kg`, `bike_id` so editing can also
  correct physics params after upload.
- Validate `tires`, `drivetrain`, `position` against the allowed enum sets from
  `physics/constants.py` in both the analyze and update paths (the PATCH path
  already validates `visibility`).

**Frontend**

- `frontend/src/api/client.js:191-205` — Add:
  - `formData.append('visibility', params.visibility)` (when present)
  - `formData.append('name', params.name)` (when present)
  - `formData.append('bike_id', params.bike_id)` (when present — Part B)
- `frontend/src/components/UploadForm.jsx` — Add a "Ride name (optional)" text
  input bound to `params.name`, placeholder "defaults to the filename".

### Tests

- Extend `backend/tests` with an API test hitting `/api/analyze` via TestClient
  and asserting saved `bike_kg`, `visibility`, `name` match the form payload
  (not defaults).
- Test reanalyze uses the snapshot when no override given, and the override
  when supplied.

---

## Part B — Feature: Bike presets (CRUD + form-populating selector) ⬜ TODO

### Behavior

Selecting a bike preset *populates* the form fields (weight/tires/drivetrain/
position). The user can still edit any populated value. The ride stores a
**snapshot** of the values used, plus an optional link to the bike preset
(`bike_id`) for traceability. Editing a bike preset later never changes past
rides (they keep their snapshot).

### Backend

- `backend/app/db/models.py Bike`
  - Add `default_riding_position (String, nullable=True)`.
  - **Resolve the unit mismatch** on `drivetrain_efficiency`: it currently stores
    a Float (0.95) but the form / physics path uses string categories
    ("optimized" / "average" / "dirty"). Migrate to a new text column
    `drivetrain` (category string) to match `Ride.drivetrain`. The old Float
    column is left in place (SQLite cannot easily DROP columns) but ignored.
- `backend/app/api/bikes.py`
  - Add `GET /{id}`, `PATCH /{id}` (edit name/weight/tires/drivetrain/
    default_riding_position), `DELETE /{id}` (on delete: set `Ride.bike_id = NULL`
    on referencing rides, preserving the per-ride snapshot values).
  - Update `BikeCreate` / `BikeResponse` schemas to:
    `name, weight_kg, tire_type, drivetrain (category), default_riding_position`.
- `backend/app/api/analyze.py`
  - Accept optional `bike_id: Optional[int] = Form(None)`; set `Ride.bike_id`
    when provided (in addition to the snapshot columns from Part A).
- `backend/app/api/rides.py RideUpdateRequest`
  - Allow updating `bike_id`.

### Frontend

- `frontend/src/api/client.js`
  - Add `createBike`, `updateBike`, `deleteBike`.
  - Pass `bike_id` (when selected) in `analyzeRide`.
- `frontend/src/components/UploadForm.jsx`
  - Add a "Bike preset" `<select>` above the param inputs (loaded via
    `fetchBikes()` when a token is present). Include a "Custom / None" option
    that leaves all fields as manual entry (default).
  - On selecting a bike preset, populate the params:
    `bike_kg = bike.weight_kg`, `tires = bike.tire_type`,
    `drivetrain = bike.drivetrain`,
    `position = bike.default_riding_position ?? params.position`.
    The user can still edit any field afterwards.
  - Inline link "+ Manage bikes" → `/bikes` route.
- New page `frontend/src/pages/BikeManager.jsx` (route `/bikes`):
  - List the user's bikes; create / edit / delete them.
  - Fields: name, weight_kg, tire_type, drivetrain (category), default_riding_position.
- `frontend/src/components/Navbar.jsx`
  - Add "My Bikes" link (authenticated only), alongside "Dashboard" etc.

### Tests

- Backend test for bike CRUD + upload with `bike_id` linking the ride to the
  bike and storing the snapshot values.

---

## Part C — Clarity: indicate whether an upload will be saved to the account ⬜ TODO

- `frontend/src/pages/Analyze.jsx`
  - Import `AuthContext`.
  - Render a status banner above the upload form:
    - Logged in → "Signed in as **{username}** — this ride will be saved to
      your account as **{visibility}**." (visibility reflects the current
      dropdown selection)
    - Not logged in → "Not signed in — analysis will be shown but not saved.
      Log in to save rides to your account." (link to `/login`)
- After a successful upload while logged in, show a confirmation toast
  "Saved to your dashboard" with a link to the ride's analysis view.

---

## Part D — Bug: Silent session expiry (global 401 + proactive exp check) ⬜ TODO

### Behavior

When a JWT expires (7-day validity), the user should be clearly notified and
redirected to login — not silently shown an empty dashboard.

### Changes

- `frontend/src/context/AuthContext.jsx`
  - On token change, decode the JWT `exp`; if `exp < Date.now()/1000`, call
    `setToken(null)` immediately (clears the stale token from localStorage).
  - While the app is open, schedule a `setTimeout` that fires `logout()` at the
    token's exact expiry time.
  - Keep `logout` exposed for the global handler to call.
- `frontend/src/api/client.js`
  - Unified `apiFetch` wrapper around `fetch`:
    - On `response.status === 401` (excluding the `/login` / `/register`
      endpoints themselves), trigger a registered global callback →
      `logout()` + `navigate('/login?reason=expired')`.
    - Attach `.status` to the thrown `Error` so callers can branch.
  - Replace the per-function `throw new Error('Failed ...')` with status-aware
    errors (keep the message, add `.status`).
  - Show a visible toast/banner: "Your session has expired — please log in again."
- `frontend/src/pages/Dashboard.jsx:15-31,111-117`
  - Add an `error` state.
  - In `.catch`, if `err.status === 401`, show "Session expired, redirecting to
    login…" instead of the cheerful empty-state panel.
  - Distinguish genuine "no rides" from auth failure in the UI.
- `frontend/src/components/Navbar.jsx`
  - Reflects logout state automatically (already derived from AuthContext, so
    clearing the token during expiry handling updates the navbar with no extra
    wiring).

### Tests

- Frontend has no test framework; verify manually by setting a short JWT
  expiry locally. Optionally add a small unit test for `apiFetch` error
  branching if a `vitest` setup is added.

---

## Part E — Feature: Collections (ride grouping, with rides-style visibility) ⬜ TODO

### Behavior

Free grouping of any of the user's rides into a named "Collection" with an
optional description and `private` / `unlisted` / `public` visibility (mirrors
the rides visibility system). **Public collections are listed on the user's
public profile** alongside their public rides. A combined-stats view groups
the collection's rides by day, links to each ride, and shows combined totals.
A combined map is explicitly out of scope for v1 (noted as a later feature).

### Backend

- `backend/app/db/models.py`
  - New `Collection` model:
    - `id, user_id (FK users.id), name, description (nullable), created_at,
       visibility (String, default="private"), share_token (String, nullable,
       unique, index)`
  - New `CollectionRide` join table:
    - `id, collection_id (FK collections.id), ride_id (FK rides.id),
       position (int, ordering)`
  - `Ride` gets a `collections` relationship.
- `backend/app/api/collections.py` (new router; registered in `main.py`)
  - `GET  /`                          — list current user's collections
  - `POST /`                          — create (name/description/visibility
                                         + optional initial ride_ids list)
  - `GET  /{id}`                      — returns collection metadata + ordered
                                         rides + combined stats + per-day breakdown
  - `PATCH /{id}`                     — rename / description / visibility /
                                         reorder rides
  - `POST /{id}/rides`                — add a ride (owned by the user)
  - `DELETE /{id}/rides/{ride_id}`    — remove a ride from the collection
  - `DELETE /{id}`                    — delete the collection (rides stay)
  - `POST  /{id}/share`               — generate/refresh `share_token`
  - `GET  /public/{token}`            — anonymous view of a shared collection
  - `GET  /user/{username}/collections` — public collections for a user
                                          (for profile linking)
  - Access control mirroring rides:
    - Owner always has access.
    - `unlisted` rides within a collection are visible only via the
      collection's share token (or to the owner).
    - `public` rides visible to anyone.
  - `backend/app/api/rides.py`
    - Public-profile endpoint(s) extended to also list a user's `public`
      collections (linked from the profile, per requirement).
- **Combined stats helper** (in `collections.py` or `physics/metrics.py`):
  - Aggregate across all rides in the collection:
    - `distance_km`, `moving_time_s`, `total_work_kj`, `elevation_gain_m`,
      `elevation_loss_m` — simple sums.
    - `avg_power_watts` — time-weighted mean over per-ride averages.
    - **`normalized_power_watts`** — **time-weighted average of per-ride NP**
      (cached on each `Ride` row). Labeled "Average Normalized Power (per-ride)"
      in the UI. NOT a true concatenated 4th-power NP (intentionally deferred).
  - Per-day breakdown:
    - Group rides by `ride.date.date()`.
    - For each day, sum distance/time/work/elevation and list the ride ids
      with links (`/analyze?ride_id=...`).
  - A combined map view is a later feature; leave a `TODO` comment only.

### Frontend

- `frontend/src/api/client.js`
  - Collection CRUD + add/remove ride + share-token operations + fetch public.
- New page `frontend/src/pages/Collections.jsx`
  - List the user's collections; create new (pick name/description/visibility +
    multi-select rides from the user's dashboard list); delete; share-link copy.
- New page `frontend/src/pages/Collection.jsx` (route `/collections/:id`)
  - Combined stats: totals cards; per-day grouped sections (each day lists ride
    links → `/analyze?ride_id=`); description; share-link.
  - Public/unlisted view via share token uses the same page with the token
    in the URL.
- `frontend/src/pages/Dashboard.jsx`
  - Add "Add to Collection" action per ride.
  - Optional multi-select bulk-add to a collection.
- `frontend/src/components/Navbar.jsx`
  - Add "Collections" link (authenticated).

### Tests

- Backend tests for collection CRUD, add/remove ride, share-token access,
  visibility enforcement (private vs unlisted vs public), public-profile listing
  of public collections, and combined-stats aggregation correctness.

---

## Part F — Chart downsampling on desktop & responsive histograms ⬜ TODO

### Current state

`frontend/src/components/RideChart.jsx:80-82` returns all ~1000 backend points
on desktop; only mobile (`window.innerWidth <= 900`) downsamples with a fixed
`bucketSize = 8`. `frontend/src/components/Histograms.jsx` has zero responsive
logic — bin counts come straight from the backend.

### Changes

- `frontend/src/components/RideChart.jsx`
  - Replace the single `isMobile` boolean with a tiered `target` point count
    derived from `window.innerWidth`:

    | `width`        | target pts | bucketSize (≈) |
    |----------------|------------|----------------|
    | `<= 600`       | ~120       | 8  (current mobile) |
    | `<= 900`       | ~200       | 5              |
    | `<= 1280`      | ~300       | 3              |
    | `<= 1800`      | ~500       | 2              |
    | `> 1800`       | ~800       | 1 (cap raw points so very long rides stay readable) |

    `bucketSize = max(1, floor(points.length / target))`.
  - Keep the existing critical-extrema preservation, gap/pause flushing,
    sort, and dedupe logic — only `bucketSize` varies with width.
  - Debounce the resize listener (avoid recomputing on every pixel of resize).
  - Continue to use `window.innerWidth` for consistency with the existing style.
- `frontend/src/components/Histograms.jsx`
  - Add the same width tiers; on narrow screens merge adjacent histogram bins
    to reduce bar count.
  - On mobile, if HR/Cad histograms are absent or trivial, hide those panels
    (keep Power + Speed as the must-haves).
  - Existing CSS `minmax(300px, 1fr)` grid stays for layout reflow.
- Backend `downsample()` (`analyze.py:24-50`) — already caps at ~1000 points
  server-side, unchanged. (Optionally fix the misleading docstring claiming it
  "preserves power extremes" while `power_w` uses `"mean"`.)

### Verification

- No frontend test framework; verify visually across breakpoints using the
  sample GPX files (the 36 km Aachen ride is long enough to stress-test desktop
  downsampling).

---

## Part G — DB migration (automatic, preserves existing data) ✅ DONE

### Requirement

- **Preserve existing rides** (~20 already in production).
- **Automatic on container start** in the Docker deployment (and in local dev).
- Idempotent — safe to run on every boot.

### Approach

Run the migration **in-app on FastAPI startup** (not via an external entrypoint
script). This guarantees both the Docker container (`uvicorn app.main:app`)
and local dev (`uvicorn ...` directly) run it automatically. No Dockerfile or
docker-compose changes are required.

### Implementation

- New module `backend/app/db/migrations.py`
  - `def run_migrations(engine) -> None` — idempotent column/table additions:
    - For each new column on `rides` (`rider_kg`, `bike_kg`, `tires`, `drivetrain`)
      and `bikes` (`default_riding_position`, `drivetrain`):
      query `PRAGMA table_info(<table>)`, and if the column is missing
      `ALTER TABLE <table> ADD COLUMN <name> <type> DEFAULT <default>`.
    - Backfill `bikes.drivetrain` from the legacy `drivetrain_efficiency` Float
      column when present:
      `0.97 → "optimized"`, `0.95 → "average"`, `0.92 → "dirty"
      (default → "average")`. Done as a one-shot `UPDATE ... WHERE drivetrain
      IS NULL`. Leaves the old Float column in place (SQLite can't easily DROP
      columns) but it is unused hereafter.
    - Backfill `rides.bike_kg` / `rider_kg` / `tires` / `drivetrain` for
      existing rows using the column DEFAULTs (10.0 / 75.0 / "commuter" /
      "average") — matches the prior behavior of the analyze/reanalyze paths
      using these hardcoded values, so existing rides re-analyze identically.
    - New tables (`collections`, `collection_rides`) are created automatically
      by `Base.metadata.create_all`.
  - Idempotent: every step is guarded by existence checks. Re-runs are no-ops.
- `backend/app/db/database.py`
  - After `Base.metadata.create_all(engine)`, call `run_migrations(engine)`.
  - (`create_all` is already invoked somewhere on import/startup — confirm
    and place the migration call right after it.)
- `backend/app/main.py`
  - Ensure `create_all` + `run_migrations` run on app startup (FastAPI
    `lifespan` or top-level on import). Existing startup behavior should
    already do `create_all`; just append the migration call.
- **No Dockerfile / docker-compose.yml changes needed.** The migration runs
  inside the uvicorn process, so the existing `CMD ["uvicorn", ...]` works
  unchanged and applies migrations on every container restart.

### Tests

- Unit test `run_migrations` is idempotent: run twice on an in-memory SQLite
  DB; assert columns exist after first run and no error on second run.
- Test backfill converts legacy `drivetrain_efficiency = 0.95` to
  `drivetrain = "average"`.
- Test existing rides are preserved and gain default values for the new
  columns, so re-analysis produces the same power numbers as before.

---

## Execution order

Each part is independently shippable; suggested order:

1. ✅ **Part G** (DB migration groundwork) — DONE
2. ⬜ **Part A** (upload save bug) — **NEXT**
3. ⬜ **Part D** (session expiry) — independent
4. ⬜ **Part C** (clarity banner) — small, after A
5. ⬜ **Part B** (bike presets) — builds on A's snapshot columns
6. ⬜ **Part F** (chart downsampling) — independent
7. ⬜ **Part E** (collections) — largest, last; depends on G's new tables

## Verification

- `cd backend && pytest` — extend tests for upload-save, bike CRUD,
  collection endpoints, and migration idempotency.
- `cd frontend && npm run lint`
- Manual smoke test matrix:
  - Upload sample GPX logged-in and logged-out; verify dashboard save/edit.
  - Verify bike_kg / visibility / name persist correctly across upload and edit.
  - Create/edit/delete a bike preset; select it in the upload form; verify
    fields populate and edit-override works.
  - Session-expiry: set short JWT TTL, let token expire, expect logout +
    redirect + toast, not a silent empty dashboard.
  - Chart readability across breakpoints (mobile, tablet, laptop, desktop, ultrawide).
  - Collections: create; add/remove rides; view combined stats grouped by day;
    share/unlisted/public access; public collection appears on the user's
    public profile.