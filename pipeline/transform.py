"""Transformations: pure functions, DataFrame in -> DataFrame out."""

import re

import pandas as pd

TEXT_COLUMNS = ["sensor", "dir_to", "dir_from"]
SENSOR_COLUMNS = ["sensor_id", "sensor", "lat", "lon", "dir_to", "dir_from"]
COUNT_COLUMNS = ["sensor_id", "timestamp", "count_to", "count_from", "count"]

# Counters #13 and #14 have this text instead of a second direction name.
MISSING_DIRECTION_PREFIX = "NIE JE"

# Older counters have no "#N" number in their name, so they get fixed IDs.
# IDs must never change: they are used as keys and in API URLs.
LEGACY_SENSOR_IDS: dict[str, int] = {
    "Cyklomost Slobody": 101,
    "Devinska Nova Ves": 102,
    "Hradza Berg": 103,
    "Viedenska": 104,
}


def strip_text(df: pd.DataFrame) -> pd.DataFrame:
    """Strip whitespace from text columns.

    The source has stray trailing newlines in directions of #13 and #14
    since 2025-03-01, which would otherwise look like a new direction.
    """
    return df.assign(**{c: df[c].str.strip() for c in TEXT_COLUMNS})


def clear_missing_direction(df: pd.DataFrame) -> pd.DataFrame:
    """Replace the "NIE JE - v mieste je jednosmerná premávka" placeholder with a missing value.

    Only the direction *name* is missing; ``count_from`` is kept as is.
    """
    is_placeholder = df["dir_from"].str.startswith(MISSING_DIRECTION_PREFIX)
    return df.assign(dir_from=df["dir_from"].mask(is_placeholder))


def sensor_id_for(name: str) -> int:
    """Stable ID: the city's own number from "#11 - Most Apollo", else a legacy ID."""
    match = re.match(r"#(\d+)\b", name)
    if match:
        return int(match.group(1))
    if name in LEGACY_SENSOR_IDS:
        return LEGACY_SENSOR_IDS[name]
    raise ValueError(
        f"Sensor {name!r} has no '#N' number. Add it to LEGACY_SENSOR_IDS "
        "in pipeline/transform.py with a new unused ID."
    )


def add_sensor_id(df: pd.DataFrame) -> pd.DataFrame:
    """Add integer ``sensor_id`` derived from the sensor name."""
    ids = {name: sensor_id_for(name) for name in df["sensor"].unique()}
    return df.assign(sensor_id=df["sensor"].map(ids).astype("int64"))


def transform(df: pd.DataFrame) -> pd.DataFrame:
    """Run all row-level transformation steps in order.

    ``timestamp`` stays in UTC. Convert to Europe/Bratislava only where
    local time matters (display, daily profiles), never for storage.
    """
    return df.pipe(strip_text).pipe(clear_missing_direction).pipe(add_sensor_id)


def split_sensors(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split into a sensor dimension table and an hourly counts fact table.

    ``sensors``: one row per counter (name, location, directions, coverage).
    ``counts``: hourly counts, linked to ``sensors`` by ``sensor_id``.
    """
    sensors = df[SENSOR_COLUMNS].drop_duplicates()
    # Catches both a sensor changing location/direction and two names sharing an ID.
    duplicated = sensors["sensor_id"][sensors["sensor_id"].duplicated()]
    if not duplicated.empty:
        raise ValueError(
            "Sensor IDs with more than one name/location/direction: "
            f"{sorted(duplicated.unique())}"
        )

    coverage = df.groupby("sensor_id")["timestamp"].agg(
        first_seen="min", last_seen="max", hours="size"
    )
    sensors = (
        sensors.rename(columns={"sensor": "name"})
        .merge(coverage, on="sensor_id")
        .sort_values("sensor_id")
        .reset_index(drop=True)
    )
    return sensors, df[COUNT_COLUMNS]
