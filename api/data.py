"""Read access to the pipeline outputs (data/processed/*.parquet).

The API never reads the CSV or calls the city's API: it only serves what
``python -m pipeline.build`` produced. Both tables are small (~4 MB), so
they are loaded into memory once and queried with pandas.

The parquet files store UTC. At load, all times are converted to Bratislava
time, so the API returns e.g. "2025-03-30T00:00:00+01:00": the same instant
as UTC, but readable as local time.
"""

import datetime as dt
from functools import lru_cache
from pathlib import Path

import pandas as pd

from pipeline.build import PROCESSED_DIR

LOCAL_TZ = "Europe/Bratislava"

SUM_FIELDS = ["count_to", "count_from", "count"]
COUNT_FIELDS = ["timestamp", *SUM_FIELDS]

# Map intensity and the typical week use this many most recent days of the dataset.
RECENT_DAYS = 365


class FootfallData:
    """Sensors and hourly counts held in memory."""

    def __init__(self, sensors: pd.DataFrame, counts: pd.DataFrame) -> None:
        sensors = sensors.assign(
            # #13 and #14 have no name for the second direction: "" instead of null.
            dir_from=sensors["dir_from"].fillna(""),
            first_seen=_to_local(sensors["first_seen"]),
            last_seen=_to_local(sensors["last_seen"]),
        )
        counts = counts.assign(timestamp=_to_local(counts["timestamp"]))
        counts = counts.assign(day=counts["timestamp"].dt.date)

        # Daily totals per sensor: base for the map intensity, typical week and months.
        self._daily = counts.groupby(["sensor_id", "day"])[SUM_FIELDS].sum().reset_index()
        self.recent_end = self._daily["day"].max()
        self.recent_start = self.recent_end - dt.timedelta(days=RECENT_DAYS - 1)

        avg_daily = self._recent_active_days().groupby("sensor_id")["count"].mean().round()
        sensors = sensors.assign(avg_daily_count=sensors["sensor_id"].map(avg_daily))

        self._sensors = sensors.set_index("sensor_id", drop=False).sort_index()
        # One table per sensor, so a request only scans that sensor's rows.
        self._counts = {
            sensor_id: group.sort_values("timestamp").reset_index(drop=True)
            for sensor_id, group in counts.groupby("sensor_id")
        }

    @classmethod
    def from_dir(cls, path: Path = PROCESSED_DIR) -> "FootfallData":
        """Load ``sensors.parquet`` and ``counts.parquet`` from ``path``."""
        sensors_path = path / "sensors.parquet"
        counts_path = path / "counts.parquet"
        if not (sensors_path.exists() and counts_path.exists()):
            raise FileNotFoundError(
                f"Parquet files not found in {path}. Run: python -m pipeline.build"
            )
        return cls(pd.read_parquet(sensors_path), pd.read_parquet(counts_path))

    def sensors(self) -> list[dict]:
        """All sensors, ordered by ``sensor_id``."""
        return _to_records(self._sensors)

    def sensor(self, sensor_id: int) -> dict | None:
        """One sensor, or ``None`` if the ID does not exist."""
        if sensor_id not in self._sensors.index:
            return None
        return _to_records(self._sensors.loc[[sensor_id]])[0]

    def counts_for_day(self, sensor_id: int, day: dt.date) -> list[dict]:
        """Hourly counts for one calendar day in Bratislava time.

        A complete day has 24 rows, clock change days 23 (March) or 25
        (October). Hours without a record are simply not in the list.
        """
        counts = self._counts.get(sensor_id)
        if counts is None:
            return []

        start, end = day_bounds(day)
        in_day = (counts["timestamp"] >= start) & (counts["timestamp"] < end)

        return _to_records(counts.loc[in_day, COUNT_FIELDS])

    def typical_week(self, sensor_id: int) -> dict:
        """Average count per weekday and hour (Bratislava time) over recent active days.

        Uses the last ``RECENT_DAYS`` days of data, only days with a count above 0,
        so outages do not pull the averages down. Weekday 0 is Monday.
        """
        active = self._recent_active_days()
        active_days = set(active.loc[active["sensor_id"] == sensor_id, "day"])
        counts = self._counts.get(sensor_id)
        if counts is None or not active_days:
            return {"active_days": 0, "hours": []}

        rows = counts[counts["day"].isin(active_days)]
        profile = (
            rows.assign(weekday=rows["timestamp"].dt.weekday, hour=rows["timestamp"].dt.hour)
            .groupby(["weekday", "hour"])[SUM_FIELDS]
            .mean()
            .round()
            .reset_index()
        )
        return {"active_days": len(active_days), "hours": _to_records(profile)}

    def months(self, sensor_id: int) -> list[dict]:
        """Per calendar month of the whole history: active days and their average daily count.

        Every month between the first and the last one is listed, also months
        without any active day (``avg_daily_count`` is then null).
        """
        daily = self._daily[self._daily["sensor_id"] == sensor_id]
        if daily.empty:
            return []

        stats = (
            daily.assign(
                month=pd.to_datetime(daily["day"]).dt.to_period("M"),
                is_active=daily["count"] > 0,
            )
            .groupby("month")
            .agg(active_days=("is_active", "sum"), total=("count", "sum"))
        )
        all_months = pd.period_range(stats.index.min(), stats.index.max(), freq="M")
        stats = stats.reindex(all_months, fill_value=0)

        return [
            {
                "month": str(month),
                "days_in_month": month.days_in_month,
                "active_days": int(row.active_days),
                "avg_daily_count": round(row.total / row.active_days) if row.active_days else None,
            }
            for month, row in stats.iterrows()
        ]

    def _recent_active_days(self) -> pd.DataFrame:
        """Daily totals in the last ``RECENT_DAYS`` days, only days with a count above 0."""
        daily = self._daily
        return daily[(daily["day"] >= self.recent_start) & (daily["count"] > 0)]


def day_bounds(day: dt.date) -> tuple[pd.Timestamp, pd.Timestamp]:
    """Local midnight at the start of ``day`` and at the start of the next day."""
    start = pd.Timestamp(day).tz_localize(LOCAL_TZ)
    end = start + pd.DateOffset(days=1)  # next local midnight, not always +24 h
    return start, end


def hours_of_day(day: dt.date) -> list[pd.Timestamp]:
    """Start of every hour of ``day``: 24, or 23 / 25 on clock change days."""
    start, end = day_bounds(day)
    return list(pd.date_range(start, end, freq="h", inclusive="left"))


def _to_local(times: pd.Series) -> pd.Series:
    return times.dt.tz_convert(LOCAL_TZ)


def _to_records(df: pd.DataFrame) -> list[dict]:
    """DataFrame -> list of dicts, with missing values as ``None`` (JSON null)."""
    return df.astype(object).where(df.notna(), None).to_dict("records")


@lru_cache
def get_data() -> FootfallData:
    """Load the data on first use and reuse it for every later request."""
    return FootfallData.from_dir()
