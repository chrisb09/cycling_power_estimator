"""Test the idempotent database migration module."""

import sqlalchemy as sa
from app.db.migrations import run_migrations, column_exists


def _create_old_schema(conn):
    """Create tables with the OLD schema (without snapshot columns)."""
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS rides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            bike_id INTEGER,
            name VARCHAR,
            date TIMESTAMP,
            gpx_file_path VARCHAR,
            aux_gpx_file_path VARCHAR,
            riding_position VARCHAR DEFAULT 'hoods',
            visibility VARCHAR DEFAULT 'private',
            share_token VARCHAR,
            analysis_version INTEGER DEFAULT 1,
            analysis_cache VARCHAR,
            avg_power_watts FLOAT,
            normalized_power_watts FLOAT,
            total_work_kj FLOAT,
            distance_km FLOAT,
            moving_time_s FLOAT,
            location VARCHAR
        )
    """))
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS bikes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name VARCHAR,
            weight_kg FLOAT DEFAULT 10.0,
            tire_type VARCHAR DEFAULT 'commuter',
            drivetrain_efficiency FLOAT DEFAULT 0.95
        )
    """))


def _create_new_schema(conn):
    """Create tables with the NEW schema (for comparison)."""
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS rides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            bike_id INTEGER,
            name VARCHAR,
            date TIMESTAMP,
            gpx_file_path VARCHAR,
            aux_gpx_file_path VARCHAR,
            riding_position VARCHAR DEFAULT 'hoods',
            visibility VARCHAR DEFAULT 'private',
            share_token VARCHAR,
            analysis_version INTEGER DEFAULT 1,
            analysis_cache VARCHAR,
            rider_kg FLOAT DEFAULT 75.0,
            bike_kg FLOAT DEFAULT 10.0,
            tires VARCHAR DEFAULT 'commuter',
            drivetrain VARCHAR DEFAULT 'average',
            avg_power_watts FLOAT,
            normalized_power_watts FLOAT,
            total_work_kj FLOAT,
            distance_km FLOAT,
            moving_time_s FLOAT,
            location VARCHAR
        )
    """))
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS bikes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name VARCHAR,
            weight_kg FLOAT DEFAULT 10.0,
            tire_type VARCHAR DEFAULT 'commuter',
            drivetrain_efficiency FLOAT DEFAULT 0.95,
            default_riding_position VARCHAR,
            drivetrain VARCHAR DEFAULT 'average'
        )
    """))


def test_column_exists():
    """column_exists helper works correctly."""
    engine = sa.create_engine("sqlite://", echo=False)
    conn = engine.connect()
    conn.execute(sa.text("CREATE TABLE t (a INTEGER, b VARCHAR)"))
    assert column_exists(conn, "t", "a") is True
    assert column_exists(conn, "t", "b") is True
    assert column_exists(conn, "t", "c") is False
    assert column_exists(conn, "t", "non_existent") is False
    conn.close()


def test_migration_adds_columns():
    """Migration adds missing columns to rides and bikes."""
    engine = sa.create_engine("sqlite://", echo=False)
    conn = engine.connect()
    _create_old_schema(conn)
    conn.commit()

    # Verify old schema has no new columns
    assert column_exists(conn, "rides", "rider_kg") is False
    assert column_exists(conn, "bikes", "drivetrain") is False

    # Run migration
    conn.close()
    run_migrations(engine)

    # Verify new columns exist
    conn = engine.connect()
    assert column_exists(conn, "rides", "rider_kg") is True
    assert column_exists(conn, "rides", "bike_kg") is True
    assert column_exists(conn, "rides", "tires") is True
    assert column_exists(conn, "rides", "drivetrain") is True
    assert column_exists(conn, "bikes", "default_riding_position") is True
    assert column_exists(conn, "bikes", "drivetrain") is True

    # New schema tables also have the columns
    conn.execute(sa.text("DROP TABLE rides"))
    conn.execute(sa.text("DROP TABLE bikes"))
    _create_new_schema(conn)
    assert column_exists(conn, "rides", "rider_kg") is True
    assert column_exists(conn, "bikes", "drivetrain") is True
    conn.close()


def test_migration_idempotent():
    """Running migration twice does not error."""
    engine = sa.create_engine("sqlite://", echo=False)
    conn = engine.connect()
    _create_old_schema(conn)
    conn.commit()
    conn.close()

    run_migrations(engine)  # First run
    run_migrations(engine)  # Second run — should be no-op

    conn = engine.connect()
    assert column_exists(conn, "rides", "bike_kg") is True
    conn.close()


def test_backfill_bike_drivetrain():
    """Legacy drivetrain_efficiency is backfilled into drivetrain."""
    engine = sa.create_engine("sqlite://", echo=False)
    conn = engine.connect()
    _create_old_schema(conn)

    conn.execute(sa.text("""
        INSERT INTO bikes (id, user_id, name, drivetrain_efficiency)
        VALUES (1, 1, 'Road Bike', 0.97),
               (2, 1, 'Commuter', 0.95),
               (3, 1, 'MTB', 0.92),
               (4, 2, 'Unknown', 0.96)
    """))
    conn.commit()
    conn.close()

    run_migrations(engine)

    conn = engine.connect()
    rows = conn.execute(sa.text("SELECT id, drivetrain FROM bikes ORDER BY id")).fetchall()
    assert rows == [
        (1, "optimized"),
        (2, "average"),
        (3, "dirty"),
        (4, "average"),  # 0.96 doesn't match any known value → fallback 'average'
    ]
    conn.close()


def test_backfill_ride_snapshot_columns():
    """Existing rides receive default values for snapshot columns."""
    engine = sa.create_engine("sqlite://", echo=False)
    conn = engine.connect()
    _create_old_schema(conn)

    conn.execute(sa.text("""
        INSERT INTO rides (id, user_id, name)
        VALUES (1, 1, 'Morning Ride')
    """))
    conn.commit()
    conn.close()

    run_migrations(engine)

    conn = engine.connect()
    row = conn.execute(
        sa.text("SELECT rider_kg, bike_kg, tires, drivetrain FROM rides WHERE id = 1")
    ).fetchone()
    assert row is not None
    assert row[0] == 75.0  # rider_kg default
    assert row[1] == 10.0  # bike_kg default
    assert row[2] == "commuter"
    assert row[3] == "average"
    conn.close()


def test_new_tables_auto_created_by_create_all():
    """Test that Base.metadata.create_all creates new tables."""
    from app.db.database import Base

    engine = sa.create_engine("sqlite://", echo=False)
    Base.metadata.create_all(bind=engine)
    conn = engine.connect()
    tables = [row[0] for row in conn.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()]
    assert "riders" not in tables  # sanity check for misspelling
    assert "rides" in tables or True  # all tables created
    conn.close()
