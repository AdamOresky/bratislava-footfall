"""Run the ETL pipeline: raw data (CSV or ArcGIS API) -> transform -> data/processed/*.parquet.

Outputs:
    sensors.parquet  one row per counter (location, directions, coverage)
    counts.parquet   hourly counts, linked to sensors by ``sensor_id``

Usage:
    python -m pipeline.build              # data/raw/footfall.csv
    python -m pipeline.build path/to.csv  # explicit input file
    python -m pipeline.build --api        # download the current data from the ArcGIS API
"""

import argparse
import time
from datetime import datetime
from pathlib import Path

import pandas as pd

from pipeline.source import API_URL, RAW_CSV, fetch_from_api, load_raw
from pipeline.transform import split_sensors, transform

PROCESSED_DIR = Path(__file__).resolve().parent.parent / "data" / "processed"


def log(step: str, message: str) -> None:
    print(f"{step:<11}{message}")


def extract(input_path: Path | None) -> pd.DataFrame:
    """Load the raw data (CSV, or the API when ``input_path`` is None) and report what was loaded."""
    if input_path is None:
        log("Extract:", f"ArcGIS API ({datetime.now():%Y-%m-%d %H:%M}) {API_URL}")
        df = fetch_from_api(log=lambda message: log("", message))
    else:
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


def build(input_path: Path | None = RAW_CSV, out_dir: Path = PROCESSED_DIR) -> None:
    """``input_path=None`` downloads the data from the ArcGIS API instead of reading a CSV."""
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
    parser = argparse.ArgumentParser(description="Build data/processed/*.parquet from the raw footfall data.")
    source = parser.add_mutually_exclusive_group()
    source.add_argument("csv", nargs="?", type=Path, default=RAW_CSV, help=f"input CSV (default: {RAW_CSV})")
    source.add_argument("--api", action="store_true", help="download the current data from the ArcGIS API instead")
    args = parser.parse_args()

    build(None if args.api else args.csv)


if __name__ == "__main__":
    main()
