"""Response models: the JSON shape of each endpoint (shown in /docs).

All times are in Europe/Bratislava with their offset, e.g. "2025-03-30T00:00:00+01:00".
"""

import datetime as dt

from pydantic import BaseModel, Field


class SensorSummary(BaseModel):
    """Short form for the sensor list (map markers)."""

    sensor_id: int
    name: str
    lat: float
    lon: float


class Sensor(SensorSummary):
    """Full detail of one sensor."""

    dir_to: str
    dir_from: str = Field(description='Empty string "" for #13 and #14 (no name in source)')
    first_seen: dt.datetime = Field(description="First hour with data")
    last_seen: dt.datetime = Field(description="Last hour with data")
    hours: int = Field(description="Number of hourly records")


class HourlyCount(BaseModel):
    timestamp: dt.datetime = Field(description="Start of the hour")
    count_to: int
    count_from: int
    count: int


class Counts(BaseModel):
    count_to: int
    count_from: int
    count: int


class DayCounts(BaseModel):
    sensor_id: int
    day: dt.date = Field(description="Calendar day in `timezone`")
    timezone: str
    was_active: bool = Field(
        description="True if at least one hour has a count above 0. False when the day "
        "has no records or all counts are 0; the source does not tell a sensor outage "
        "from a real zero, so a day with truly no pedestrians is also false."
    )
    hours_with_data: int = Field(description="Hours that have a record (may be < hours_in_day)")
    hours_in_day: int = Field(description="24, or 23 / 25 on clock change days")
    missing_hours: list[dt.datetime] = Field(
        description="Start of each hour of the day without a record; empty for a complete day"
    )
    counts_total: Counts | None = Field(
        description="Sum of `counts_by_hour`; null when the day has no data"
    )
    counts_by_hour: list[HourlyCount]
