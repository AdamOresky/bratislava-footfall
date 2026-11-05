// region Messages

export const FailureMessage = {
    dataNotLoaded: "Dáta sa nepodarilo načítať",
} as const;

// endregion

// region Sensor

export interface SensorSummary {
    sensor_id: number,
    name: string,
    lat: number,
    lon: number,
    avg_daily_count: number | null,   // null = no measurements in the last year
}

export interface Sensor extends SensorSummary {
    dir_to: string,
    dir_from: string,      // "" for #13 and #14 (no name in source)
    first_seen: string,    // e.g. "2022-08-31T23:00:00+02:00"
    last_seen: string,
    hours: number,
}

// endregion

// region Counts

export interface Counts {
    count_to: number,
    count_from: number,
    count: number,
}

export interface HourlyCount extends Counts {
    timestamp: string,
}

export interface DayCounts {
    sensor_id: number,
    day: string,           // "YYYY-MM-DD"
    timezone: string,
    was_active: boolean,
    hours_with_data: number,
    hours_in_day: number,
    missing_hours: string[],
    counts_total: Counts | null,
    counts_by_hour: HourlyCount[],
}

// endregion
