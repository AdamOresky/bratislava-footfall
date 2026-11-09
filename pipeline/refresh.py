"""Daily data refresh on the server: ArcGIS API -> checks -> replace data/processed/*.parquet.

Run by the systemd timer ``deploy/chodci-refresh.timer``; can also be run by hand:

    python -m pipeline.refresh

The new files are built into ``data/processed/staging/`` first and only replace
the current ones if they pass the checks below. If the download or a check
fails, the script exits with code 1, the current files stay untouched and the
API keeps serving them (systemd then also skips the API restart).

The whole dataset is downloaded every time, not only the new hours: the city
revises data up to 2 months back, and a full download takes about a minute.
"""

import os
import shutil
import sys
from pathlib import Path

import pandas as pd

from pipeline.build import PROCESSED_DIR, build, log

STAGING_DIR = PROCESSED_DIR / "staging"
FILES = ["sensors.parquet", "counts.parquet"]

# The new data may have at most 5 % fewer hourly rows than the current data.
# The dataset only grows (new hours) or is revised in place, so a bigger drop
# means a broken download or a problem at the source, not real data.
MIN_ROWS_RATIO = 0.95


def check(new: dict[str, pd.DataFrame], current: dict[str, pd.DataFrame] | None) -> list[str]:
    """Problems that should stop the new data from replacing the current data; empty if none.

    ``current`` is None on the first run (no data yet): then only the new data is checked.
    """
    problems = []
    new_counts, new_sensors = new["counts.parquet"], new["sensors.parquet"]
    if new_counts.empty or new_sensors.empty:
        return ["new data is empty"]

    unknown = set(new_counts["sensor_id"]) - set(new_sensors["sensor_id"])
    if unknown:
        problems.append(f"counts for sensors missing in sensors.parquet: {sorted(unknown)}")

    if current is None:
        return problems

    cur_counts, cur_sensors = current["counts.parquet"], current["sensors.parquet"]

    min_rows = int(len(cur_counts) * MIN_ROWS_RATIO)
    if len(new_counts) < min_rows:
        problems.append(f"{len(new_counts):,} hourly rows, current data has {len(cur_counts):,} (minimum {min_rows:,})")

    if new_counts["timestamp"].max() < cur_counts["timestamp"].max():
        problems.append(
            f"newest hour {new_counts['timestamp'].max()} is older than "
            f"the current newest hour {cur_counts['timestamp'].max()}"
        )

    # Sensor IDs are used in API URLs, a sensor must not disappear unnoticed.
    missing = set(cur_sensors["sensor_id"]) - set(new_sensors["sensor_id"])
    if missing:
        problems.append(f"sensors missing in the new data: {sorted(missing)}")

    return problems


def read(directory: Path) -> dict[str, pd.DataFrame] | None:
    """Both parquet files from ``directory``, or None if they are not there."""
    if not all((directory / name).exists() for name in FILES):
        return None
    return {name: pd.read_parquet(directory / name) for name in FILES}


def refresh() -> bool:
    """Download, check and replace the data. True if the data was replaced."""
    shutil.rmtree(STAGING_DIR, ignore_errors=True)
    build(input_path=None, out_dir=STAGING_DIR)

    new = read(STAGING_DIR)
    current = read(PROCESSED_DIR)
    problems = check(new, current)
    if problems:
        log("Check:", "FAILED, current data kept")
        for problem in problems:
            log("", problem)
        return False

    counts = new["counts.parquet"]
    log("Check:", f"OK, {len(counts):,} rows, newest hour {counts['timestamp'].max()}")
    if current is not None:
        diff = len(counts) - len(current["counts.parquet"])
        log("", f"{diff:+,} rows against the current data")

    # os.replace is atomic: each file is either the old or the new one, never half written.
    for name in FILES:
        os.replace(STAGING_DIR / name, PROCESSED_DIR / name)
    STAGING_DIR.rmdir()
    log("Replaced:", ", ".join(FILES))
    return True


def main() -> None:
    # A failed download raises: Python then prints the traceback and exits with code 1,
    # before anything was replaced.
    sys.exit(0 if refresh() else 1)


if __name__ == "__main__":
    main()
