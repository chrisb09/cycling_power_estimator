"""Idempotent database migrations, run on app startup.

Adds new columns to existing tables without dropping or recreating them.
Uses PRAGMA table_info to check column existence before ALTER TABLE.
"""
import sqlalchemy as sa


def column_exists(conn, table: str, column: str) -> bool:
    """Check whether a column exists in a SQLite table."""
    rows = conn.execute(sa.text(f"PRAGMA table_info(\"{table}\")")).fetchall()
    return any(row[1] == column for row in rows)


def run_migrations(engine):
    """Idempotent migration: adds new columns to existing tables and backfills."""

    conn = engine.connect()

    # ── rides ────────────────────────────────────────────────────────────
    ride_columns = [
        ("rider_kg", "FLOAT"),
        ("bike_kg", "FLOAT"),
        ("tires", "VARCHAR"),
        ("drivetrain", "VARCHAR"),
    ]
    for col_name, col_type in ride_columns:
        if not column_exists(conn, "rides", col_name):
            conn.execute(sa.text(
                f"ALTER TABLE rides ADD COLUMN {col_name} {col_type}"
            ))

    # Backfill snapshot columns (unconditional — safe to run on already-backfilled rows)
    for col_name, col_default in (
        ("rider_kg", "75.0"),
        ("bike_kg", "10.0"),
        ("tires", "'commuter'"),
        ("drivetrain", "'average'"),
    ):
        conn.execute(sa.text(
            f"UPDATE rides SET {col_name} = {col_default} WHERE {col_name} IS NULL"
        ))

    # ── bikes ────────────────────────────────────────────────────────────
    if not column_exists(conn, "bikes", "default_riding_position"):
        conn.execute(sa.text(
            "ALTER TABLE bikes ADD COLUMN default_riding_position VARCHAR"
        ))

    if not column_exists(conn, "bikes", "drivetrain"):
        conn.execute(sa.text(
            "ALTER TABLE bikes ADD COLUMN drivetrain VARCHAR"
        ))

    # Backfill bikes.drivetrain from legacy drivetrain_efficiency
    # Must use searched CASE (WHEN condition) not simple CASE (expr WHEN value)
    # because simple CASE does float comparison incorrectly in SQLite
    conn.execute(sa.text(
        "UPDATE bikes SET drivetrain = "
        "  CASE "
        "    WHEN ROUND(drivetrain_efficiency, 2) = 0.97 THEN 'optimized' "
        "    WHEN ROUND(drivetrain_efficiency, 2) = 0.95 THEN 'average' "
        "    WHEN ROUND(drivetrain_efficiency, 2) = 0.92 THEN 'dirty' "
        "    ELSE 'average' "
        "  END "
        "WHERE drivetrain IS NULL"
    ))

    conn.commit()
    conn.close()
