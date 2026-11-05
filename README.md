# Bratislava footfall

**▶ Live demo: [chodci.oresky.sk](https://chodci.oresky.sk)** · API dokumentácia: [chodci.oresky.sk/api/docs](https://chodci.oresky.sk/api/docs)

Analýza a vizualizácia hodinových dát o pohybe chodcov zo sčítačov v meste Bratislava.

## Dáta

- **Zdroj:** [Počet prechádzajúcich chodcov podľa sčítačov za hodinu](https://data.bratislava.sk/maps/84ba9f28423e4a52aae97c8cfb7d58e6),
  Hlavné mesto SR Bratislava, portál otvorených dát
- **Licencia:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Úpravy:** dáta sú v tomto projekte spracované (premenované stĺpce, očistené texty,
  rozdelenie na tabuľky), viď [ETL pipeline](#etl-pipeline)
- **Stiahnuté:** 05.11.2026

CSV má ~87 MB, preto nie je v repozitári. Stiahnite ho zo stránky datasetu
(pôvodný názov `Počet_prechádzajúcich_chodcov_podľa_sčítačov_za_hodinu.csv`)
a uložte ako `data/raw/footfall.csv`.

## Spustenie

Windows (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m pipeline.build
```

Linux / macOS:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m pipeline.build
```

## ETL pipeline

`python -m pipeline.build` spracuje `data/raw/footfall.csv` (~87 MB)
a vytvorí v `data/processed/`:

| súbor | obsah |
|---|---|
| `sensors.parquet` | 23 riadkov: `sensor_id`, `name`, poloha, smery, obdobie dát (`first_seen`, `last_seen`, `hours`) |
| `counts.parquet` | ~800 tis. riadkov: hodinové počty (`sensor_id`, `timestamp` v UTC, `count_to`, `count_from`, `count`) |

Tabuľky sú prepojené stĺpcom `sensor_id`. ID je číslo, ktoré mesto uvádza v názve
sčítača („#11 - Most Apollo“ => 11). Staršie sčítače bez čísla majú pevne pridelené
ID 101–104 (`LEGACY_SENSOR_IDS` v `pipeline/transform.py`). ID sa nesmú meniť,
používajú sa ako kľúče a v URL API.

1. **Extract** (`pipeline/source.py`): načítanie CSV a premenovanie stĺpcov
2. **Transform** (`pipeline/transform.py`): čistenie textov, chýbajúce názvy smerov,
   rozdelenie na sčítače a počty
3. **Load** (`pipeline/build.py`): zápis do parquet súborov

Časy sa ukladajú v UTC.

### Kvalita zdrojových dát

- Smery pri #13 a #14 majú od 1.3.2025 navyše znak nového riadku. Pipeline ich orezáva.
- #13 a #14 nemajú názov druhého smeru: v zdroji je namiesto neho text
  „NIE JE - v mieste je jednosmerná premávka“, pipeline ho nahrádza prázdnou hodnotou
  (`dir_from`). Počty pre tento smer (`count_from`) sa zachovávajú.
- #18 a #19 majú v zdroji identické súradnice, hoci ide o rôzne miesta.
- Cyklomost Slobody, Devínska Nová Ves, Hrádza Berg a Viedenská sú staršie sčítače
  (dáta od 2014 / 2019) bez čísla.
- V niektorých dňoch chýbajú hodinové záznamy, napr. jedna z dvoch hodín 02:00
  pri jesennej zmene času. API ich nedopĺňa, uvádza ich v `missing_hours`.
- Niektoré sčítače majú celé dni (aj dlhé obdobia) so samými nulami. Zo zdroja
  sa nedá zistiť, či ide o výpadok, alebo o skutočnú nulu. API takýto deň vracia
  s `was_active: false`.

## API

FastAPI nad výstupmi pipeline (najprv spustite `python -m pipeline.build`):

```
uvicorn api.main:app --reload
```

Interaktívna dokumentácia: http://127.0.0.1:8000/docs

| endpoint | popis                                               |
|---|-----------------------------------------------------|
| `GET /sensors` | všetky sčítače: `sensor_id`, `name`, `lat`, `lon`, `avg_daily_count` (priemer chodcov za deň za posledných 365 dní, iba dni s meraním) |
| `GET /sensors/{sensor_id}` | jeden sčítač so smermi a obdobím dát |
| `GET /sensors/{sensor_id}/counts?date=2025-04-18` | hodinové počty za deň v bratislavskom časovom pásme |
| `GET /sensors/{sensor_id}/typical-week` | priemerný počet za hodinu podľa dňa v týždni (posledných 365 dní, iba dni s meraním) |
| `GET /sensors/{sensor_id}/months` | priemerný počet za deň v každom mesiaci celej histórie (iba dni s meraním) |

Parquet súbory ukladajú UTC, API vracia časy v `Europe/Bratislava` s posunom,
napr. `2025-03-30T00:00:00+01:00` (ten istý okamih ako `2025-03-29T23:00:00Z`).
Deň v `?date=` sa berie v bratislavskom časovom pásme. Bežný deň má 24 hodín, deň zmeny
času 23 (marec) alebo 25 (október).

Odpoveď `/counts` obsahuje okrem hodinových počtov aj:

| pole | význam |
|---|---|
| `was_active` | `false`, ak deň nemá záznamy alebo sú všetky počty 0 |
| `hours_with_data` / `hours_in_day` | koľko hodín má záznam / koľko hodín má deň |
| `missing_hours` | začiatky hodín bez záznamu (prázdne pri úplnom dni) |
| `counts_total` | súčet za deň, `null` ak deň nemá záznamy |

## Štruktúra

```
data/raw/             surové dáta (CSV, necommitnuté, verejne stiahnuteľné)
data/processed/       výstupy pipeline (parquet, nahrávajú sa na server)
pipeline/source.py    E: načítanie dát a zjednotenie stĺpcov
pipeline/transform.py T: čisté funkcie DataFrame → DataFrame
pipeline/build.py     orchestrácia E => T => L, vstupný bod pipeline
api/data.py           načítanie parquet súborov a dotazy nad nimi
api/schemas.py        tvar JSON odpovedí (Pydantic modely)
api/main.py           FastAPI endpointy
frontend/             React (Vite + TypeScript): mapa sčítačov a detail dňa
deploy/               nasadenie na VPS: postup, systemd služba, nginx
```

## Frontend

React aplikácia nad API (najprv spustite API, viď vyššie):

```
cd frontend
npm install
npm run dev
```

Otvorte http://localhost:5173. Mapa (`/`) ukazuje všetky sčítače. Po kliknutí na sčítač
sa otvorí detail (`/sensor/{sensor_id}?date=YYYY-MM-DD`) s hodinovým grafom za vybraný deň.
Adresa API je v `frontend/src/config.json` (`localUrl` pri vývoji, `serverUrl` v produkcii).

## Nasadenie

Frontend aj API bežia na jednom VPS za nginx na https://chodci.oresky.sk: nginx servíruje
zbuildovaný React a požiadavky na `/api` posiela na uvicorn (služba systemd).
Postup a konfiguračné súbory sú v [`deploy/`](deploy/README.md).

## Ďalšie kroky

Dáta sa zatiaľ načítavajú z CSV. Pripravené je rozšírenie na priame sťahovanie
cez ArcGIS REST API.
