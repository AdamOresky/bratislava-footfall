"""Loading raw footfall data.

This is the only module that knows where the data comes from. There are two
sources with the same content:

    load_raw()        CSV downloaded by hand from the dataset page
    fetch_from_api()  the dataset's ArcGIS FeatureServer, always up to date

Everything else works with the DataFrame they return, which always has the
same columns no matter the source:

    sensor      (str)                  counter name, e.g. "#11 - Most Apollo"
    lat, lon    (float)                counter location (WGS84)
    dir_to      (str)                  direction A, e.g. "Centrum"
    dir_from    (str)                  direction B, e.g. "Petržalka"
    timestamp   (datetime64[ns, UTC])  start of the hourly interval
    count_to    (int64)                pedestrians heading towards dir_to
    count_from  (int64)                pedestrians heading from dir_to (towards dir_from)
    count       (int64)                count_to + count_from
"""

import gzip
import json
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

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

# CSV timestamps look like "2025/04/18 19:00:00+00" (UTC).
TIMESTAMP_FORMAT = "%Y/%m/%d %H:%M:%S+00"

# Feature service behind the dataset page (ArcGIS item 84ba9f28423e4a52aae97c8cfb7d58e6).
# The data is a table (no geometry); its timestamps are ISO 8601 strings.
API_URL = (
    "https://services8.arcgis.com/pRlN1m0su5BYaFAS/arcgis/rest/services/"
    "chodci10_01/FeatureServer/0/query"
)
API_OBJECT_ID = "ObjectId"
# resultType=standard raises the per-request limit from 1000 to 32000 rows,
# so the whole dataset (~860k rows) takes ~30 requests instead of ~860.
API_PAGE_SIZE = 32000
API_TIMEOUT_S = 120
API_RETRIES = 3


def load_raw(path: Path = RAW_CSV) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(
            f"{path} not found. Download the CSV from the dataset page "
            "and save it as data/raw/footfall.csv (see README)."
        )
    return _normalise(_read_csv(path), TIMESTAMP_FORMAT)


def _read_csv(path: Path) -> pd.DataFrame:
    """Read only the columns we use, still under their original names."""
    # utf-8-sig strips the BOM the portal puts at the start of the file.
    return pd.read_csv(path, encoding="utf-8-sig", usecols=list(COLUMN_MAP))


def fetch_from_api(url: str = API_URL, log=print) -> pd.DataFrame:
    """Download the whole dataset from the ArcGIS FeatureServer.

    Pages by ObjectId (``ObjectId > last seen``) rather than by offset, so a
    page never skips or repeats rows. The result is checked against the
    server's own row count.
    """
    expected = _query(url, where="1=1", returnCountOnly="true")["count"]
    log(f"{expected:,} rows on the server")

    pages: list[pd.DataFrame] = []
    last_id = -1
    fetched = 0
    while True:
        data = _query(
            url,
            where=f"{API_OBJECT_ID} > {last_id}",
            outFields=",".join([API_OBJECT_ID, *COLUMN_MAP]),
            orderByFields=API_OBJECT_ID,
            returnGeometry="false",
            resultType="standard",
            resultRecordCount=API_PAGE_SIZE,
        )
        rows = [feature["attributes"] for feature in data["features"]]
        if not rows:
            break
        page = pd.DataFrame.from_records(rows)
        pages.append(page)
        last_id = int(page[API_OBJECT_ID].max())
        fetched += len(page)
        log(f"{fetched:,} / {expected:,}")

    df = pd.concat(pages, ignore_index=True)
    if len(df) != expected or df[API_OBJECT_ID].duplicated().any():
        raise RuntimeError(
            f"API returned {len(df):,} rows ({df[API_OBJECT_ID].nunique():,} unique), "
            f"expected {expected:,}. The data may have changed during the download; run again."
        )
    return _normalise(df.drop(columns=API_OBJECT_ID), "ISO8601")


def _query(url: str, **params) -> dict:
    """One FeatureServer ``/query`` request, retried a few times on network errors."""
    request = Request(
        f"{url}?{urlencode({**params, 'f': 'json'})}",
        headers={"Accept-Encoding": "gzip", "User-Agent": "bratislava-footfall pipeline"},
    )
    for attempt in range(1, API_RETRIES + 1):
        try:
            with urlopen(request, timeout=API_TIMEOUT_S) as response:
                body = response.read()
                if response.headers.get("Content-Encoding") == "gzip":
                    body = gzip.decompress(body)
            break
        except OSError:   # URLError, timeouts, dropped connections
            if attempt == API_RETRIES:
                raise
            time.sleep(2 ** attempt)

    data = json.loads(body)
    # ArcGIS reports errors in the body with HTTP 200.
    if "error" in data:
        raise RuntimeError(f"ArcGIS API error: {data['error']}")
    return data


def _normalise(df: pd.DataFrame, timestamp_format: str) -> pd.DataFrame:
    """Rename columns, parse timestamps, add the total count and sort."""
    df = df.rename(columns=COLUMN_MAP)
    df["timestamp"] = pd.to_datetime(df["timestamp"], format=timestamp_format, utc=True)
    df["count"] = df["count_to"] + df["count_from"]

    return df.sort_values(["sensor", "timestamp"]).reset_index(drop=True)
