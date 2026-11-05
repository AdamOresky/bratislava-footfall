"""Loading raw footfall data.

This is the only module that knows where the data comes from. Everything
else works with the DataFrame returned by ``load_raw()``, which always
has the same columns no matter the source:

    sensor      (str)                  counter name, e.g. "#11 - Most Apollo"
    lat, lon    (float)                counter location (WGS84)
    dir_to      (str)                  direction A, e.g. "Centrum"
    dir_from    (str)                  direction B, e.g. "Petržalka"
    timestamp   (datetime64[ns, UTC])  start of the hourly interval
    count_to    (int64)                pedestrians heading towards dir_to
    count_from  (int64)                pedestrians heading from dir_to (towards dir_from)
    count       (int64)                count_to + count_from
"""

from pathlib import Path

import pandas as pd

RAW_CSV = Path(__file__).resolve().parent.parent / "data" / "raw" / "footfall.csv"

# Original CSV column name -> our name.
COLUMN_MAP: dict[str, str] = {
    "NAZOV": "sensor",
    "ZEMEPISNA_SIRKA": "lat",
    "ZEMEPISNA_DLZKA": "lon",
    "SMER_DO": "dir_to",
    "SMER_Z": "dir_from",
    "DATUM_A_CAS": "timestamp",
    "POCET_DO": "count_to",
    "POCET_Z": "count_from",
}

# Timestamps look like "2025/04/18 19:00:00+00" (UTC).
TIMESTAMP_FORMAT = "%Y/%m/%d %H:%M:%S+00"


def load_raw(path: Path = RAW_CSV) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(
            f"{path} not found. Download the CSV from the dataset page "
            "and save it as data/raw/footfall.csv (see README)."
        )
    return _normalise(_read_csv(path))


def _read_csv(path: Path) -> pd.DataFrame:
    """Read only the columns we use, still under their original names."""
    # utf-8-sig strips the BOM the portal puts at the start of the file.
    return pd.read_csv(path, encoding="utf-8-sig", usecols=list(COLUMN_MAP))


def _normalise(df: pd.DataFrame) -> pd.DataFrame:
    """Rename columns, parse timestamps, add the total count and sort."""
    df = df.rename(columns=COLUMN_MAP)
    df["timestamp"] = pd.to_datetime(df["timestamp"], format=TIMESTAMP_FORMAT, utc=True)
    df["count"] = df["count_to"] + df["count_from"]

    return df.sort_values(["sensor", "timestamp"]).reset_index(drop=True)
