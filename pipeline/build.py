"""Run the ETL pipeline: raw CSV -> transform -> data/processed/*.parquet.

Outputs:
    sensors.parquet  one row per counter (location, directions, coverage)
    counts.parquet   hourly counts, linked to sensors by ``sensor_id``

Usage:
    python -m pipeline.build              # data/raw/footfall.csv
    python -m pipeline.build path/to.csv  # explicit input file
"""

import sys
import time
from datetime import datetime
from pathlib import Path

import pandas as pd

from pipeline.source import RAW_CSV, load_raw
from pipeline.transform import split_sensors, transform

PROCESSED_DIR = Path(__file__).resolve().parent.parent / "data" / "processed"


def log(step: str, message: str) -> None:
    print(f"{step:<11}{message}")


def extract(input_path: Path) -> pd.DataFrame:
    """Load the raw CSV and report what was loaded."""
    df = load_raw(input_path)

    modified = datetime.fromtimestamp(input_path.stat().st_mtime)
    log("Extract:", f"{input_path.name} (modified {modified:%Y-%m-%d %H:%M})")
    log("", f"{len(df):,} rows, {df['sensor'].nunique()} sensors")
    return df


def save_parquet(df: pd.DataFrame, name: str, out_dir: Path) -> None:
    """Write ``df`` to ``out_dir/<name>.parquet`` and report its size."""
    path = out_dir / f"{name}.parquet"
    df.to_parquet(path, index=False)

    size_mb = path.stat().st_size / 1e6
    log("", f"{path.name}: {len(df):,} rows, {size_mb:.1f} MB")


def build(input_path: Path = RAW_CSV, out_dir: Path = PROCESSED_DIR) -> None:
    start = time.perf_counter()

    raw = extract(input_path)

    log("Transform:", "strip text, missing direction names, sensor IDs, split sensors")
    sensors, counts = split_sensors(transform(raw))

    log("Load:", str(out_dir))
    out_dir.mkdir(parents=True, exist_ok=True)
    save_parquet(sensors, "sensors", out_dir)
    save_parquet(counts, "counts", out_dir)

    elapsed = time.perf_counter() - start
    log("Done:", f"{elapsed:.1f} s")


def main() -> None:
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else RAW_CSV
    build(input_path)


if __name__ == "__main__":
    main()
