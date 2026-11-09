"""Response models: the JSON shape of each endpoint (shown in /docs).

All times are in Europe/Bratislava with their offset, e.g. "2025-03-30T00:00:00+01:00".
"""

import datetime as dt

from pydantic import BaseModel, Field


class Status(BaseModel):
    """What data the API currently serves."""

    data_until: dt.datetime = Field(description="Newest hour in the data, over all sensors")
    sensors: int
    hourly_records: int


class SensorSummary(BaseModel):
    """Short form for the sensor list (map markers)."""

    sensor_id: int
    name: str
    lat: float
    lon: float
    avg_daily_count: int | None = Field(
        description="Average pedestrians per day over the last 365 days of data, "
        "counting only days with data above 0; null if there is no such day"
    )


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


class WeekHour(BaseModel):
    weekday: int = Field(description="0 = Monday … 6 = Sunday")
    hour: int = Field(description="0–23, Bratislava time")
    count_to: int = Field(description="Average")
    count_from: int = Field(description="Average")
    count: int = Field(description="Average")


class TypicalWeek(BaseModel):
    sensor_id: int
    timezone: str
    period_start: dt.date = Field(description="First day of the period the averages use")
    period_end: dt.date
    active_days: int = Field(description="Days in the period with a count above 0 (the ones averaged)")
    hours: list[WeekHour] = Field(description="Empty when the sensor has no active day in the period")


class MonthStats(BaseModel):
    month: str = Field(description="YYYY-MM")
    days_in_month: int
    active_days: int = Field(description="Days with a count above 0")
    avg_daily_count: int | None = Field(description="Average daily count over active days; null if none")


class Months(BaseModel):
    sensor_id: int
    months: list[MonthStats]


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
