"""REST API over the processed footfall data.

Run:
    uvicorn api.main:app --reload

Interactive docs: http://127.0.0.1:8000/docs
"""

import datetime as dt
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from api.data import LOCAL_TZ, FootfallData, get_data, hours_of_day
from api.schemas import DayCounts, Months, Sensor, SensorSummary, TypicalWeek

app = FastAPI(
    title="Bratislava footfall API",
    description="Hourly pedestrian counts from Bratislava counters. "
    "Source: Hlavné mesto SR Bratislava, CC BY 4.0.",
)

# Browsers may call the API from the live site and from the React dev server (any local port).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://chodci.oresky.sk"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["GET"],
)

Data = Annotated[FootfallData, Depends(get_data)]

COUNT_SUM_FIELDS = ["count_to", "count_from", "count"]


def require_sensor(sensor_id: int, data: FootfallData) -> dict:
    sensor = data.sensor(sensor_id)
    if sensor is None:
        raise HTTPException(status_code=404, detail=f"Sensor {sensor_id} not found")
    return sensor


@app.get("/sensors", response_model=list[SensorSummary])
def list_sensors(data: Data):
    """All counters: ID, name and location. Details in `/sensors/{sensor_id}`."""
    return data.sensors()


@app.get("/sensors/{sensor_id}", response_model=Sensor)
def get_sensor(sensor_id: int, data: Data):
    """One counter with directions and data coverage."""
    return require_sensor(sensor_id, data)


@app.get("/sensors/{sensor_id}/counts", response_model=DayCounts)
def get_day_counts(
    sensor_id: int,
    day: Annotated[dt.date, Query(alias="date", description="Day in Bratislava time, YYYY-MM-DD")],
    data: Data,
):
    """Hourly counts of one counter for one day (Bratislava time).

    Timestamps are in Bratislava time with their offset (+01:00 / +02:00).
    No data for that day: empty `counts_by_hour` and `counts_total` null.
    """
    require_sensor(sensor_id, data)
    counts_by_hour = data.counts_for_day(sensor_id, day)
    counts_total = sum_counts(counts_by_hour)

    all_hours = hours_of_day(day)
    recorded = {row["timestamp"] for row in counts_by_hour}
    missing_hours = [hour for hour in all_hours if hour not in recorded]

    return {
        "sensor_id": sensor_id,
        "day": day,
        "timezone": LOCAL_TZ,
        "was_active": counts_total is not None and counts_total["count"] > 0,
        "hours_with_data": len(counts_by_hour),
        "hours_in_day": len(all_hours),
        "missing_hours": missing_hours,
        "counts_total": counts_total,
        "counts_by_hour": counts_by_hour,
    }


@app.get("/sensors/{sensor_id}/typical-week", response_model=TypicalWeek)
def get_typical_week(sensor_id: int, data: Data):
    """Average hourly counts per weekday over the last 365 days of data (active days only)."""
    require_sensor(sensor_id, data)
    return {
        "sensor_id": sensor_id,
        "timezone": LOCAL_TZ,
        "period_start": data.recent_start,
        "period_end": data.recent_end,
        **data.typical_week(sensor_id),
    }


@app.get("/sensors/{sensor_id}/months", response_model=Months)
def get_months(sensor_id: int, data: Data):
    """Average daily count per calendar month over the whole history (active days only)."""
    require_sensor(sensor_id, data)
    return {"sensor_id": sensor_id, "months": data.months(sensor_id)}


def sum_counts(rows: list[dict]) -> dict | None:
    """Add up the counts of all rows; ``None`` if there are no rows.

    No rows means no data, not zero pedestrians, so the total is null, not 0.
    """
    if not rows:
        return None
    return {field: sum(row[field] for row in rows) for field in COUNT_SUM_FIELDS}
