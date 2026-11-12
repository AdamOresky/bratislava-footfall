# Bratislava footfall

**▶ Live demo: [chodci.oresky.sk](https://chodci.oresky.sk)** · API dokumentácia: [chodci.oresky.sk/api/docs](https://chodci.oresky.sk/api/docs)

Analýza a vizualizácia hodinových dát o pohybe chodcov zo sčítačov v meste Bratislava.
Živá verzia sa aktualizuje automaticky každý deň o 03:00 z otvorených dát mesta
(ArcGIS API, s kontrolou dát pred nasadením a e-mailom pri chybe).

## Dáta

- **Zdroj:** [Počet prechádzajúcich chodcov podľa sčítačov za hodinu](https://data.bratislava.sk/maps/84ba9f28423e4a52aae97c8cfb7d58e6),
  Hlavné mesto SR Bratislava, portál otvorených dát
- **Licencia:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Úpravy:** dáta sú v tomto projekte spracované (premenované stĺpce, očistené texty,
  rozdelenie na tabuľky), viď [ETL pipeline](#etl-pipeline)
- **Aktualizácia:** živá verzia sťahuje dáta z API každý deň o 03:00
  (viď [nasadenie](deploy/README.md#denná-aktualizácia-dát)). `data/processed/*.parquet`
  v repozitári obsahujú dáta do 09.11.2026 00:00.

Dáta sa dajú získať dvoma spôsobmi, obsah je rovnaký:

- **ArcGIS API** (odporúčané): `python -m pipeline.build --api` stiahne aktuálne dáta
  priamo z [FeatureServera](https://services8.arcgis.com/pRlN1m0su5BYaFAS/arcgis/rest/services/chodci10_01/FeatureServer/0)
  datasetu, za ~1 minútu.
- **CSV**: stiahnite ho zo stránky datasetu (pôvodný názov
  `Počet_prechádzajúcich_chodcov_podľa_sčítačov_za_hodinu.csv`) a uložte ako
  `data/raw/footfall.csv`. Má ~87 MB, preto nie je v repozitári.

CSV zo stránky datasetu môže byť staršie ako dáta v API: súbor stiahnutý 05.11.2026
končil 10.07.2026, API v rovnaký deň vracalo dáta do 05.11.2026.

## Spustenie

Windows (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m pipeline.build --api
```

Linux / macOS:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m pipeline.build --api
```

Posledný krok stiahne aktuálne dáta z API. Nie je povinný: `data/processed/*.parquet`
sú v repozitári, API a frontend bežia aj s nimi. S CSV v `data/raw/footfall.csv`
stačí `python -m pipeline.build`.

## ETL pipeline

`python -m pipeline.build` spracuje `data/raw/footfall.csv` (~87 MB),
`python -m pipeline.build --api` namiesto toho stiahne dáta z ArcGIS API.
Oba vytvoria v `data/processed/`:

| súbor | obsah |
|---|---|
| `sensors.parquet` | 23 riadkov: `sensor_id`, `name`, poloha, smery, obdobie dát (`first_seen`, `last_seen`, `hours`) |
| `counts.parquet` | ~860 tis. riadkov: hodinové počty (`sensor_id`, `timestamp` v UTC, `count_to`, `count_from`, `count`) |

Tabuľky sú prepojené stĺpcom `sensor_id`. ID je číslo, ktoré mesto uvádza v názve
sčítača („#11 - Most Apollo“ => 11). Staršie sčítače bez čísla majú pevne pridelené
ID 101–104 (`LEGACY_SENSOR_IDS` v `pipeline/transform.py`). ID sa nesmú meniť,
používajú sa ako kľúče a v URL API.

1. **Extract** (`pipeline/source.py`): načítanie CSV (`load_raw()`) alebo stiahnutie
   z API (`fetch_from_api()`) a premenovanie stĺpcov. Obe funkcie vracajú rovnaký
   DataFrame, ďalšie kroky nevedia, odkiaľ dáta prišli. API sa stránkuje po 32 000
   riadkoch podľa `ObjectId` a výsledok sa overuje proti počtu riadkov na serveri.
2. **Transform** (`pipeline/transform.py`): čistenie textov, chýbajúce názvy smerov,
   rozdelenie na sčítače a počty
3. **Load** (`pipeline/build.py`): zápis do parquet súborov

Časy sa ukladajú v UTC.

Na serveri beží denne `python -m pipeline.refresh`: rovnaký build z API, ale do dočasného
priečinka, a aktuálne súbory nahradí až po kontrolách (počet riadkov, najnovšia hodina,
zoznam sčítačov). Pri chybe ostanú pôvodné dáta.

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

FastAPI nad výstupmi pipeline (`data/processed/*.parquet`, sú v repozitári):

```
uvicorn api.main:app --reload
```

Interaktívna dokumentácia: http://127.0.0.1:8000/docs

| endpoint | popis                                               |
|---|-----------------------------------------------------|
| `GET /status` | aké dáta API práve servuje: `data_until` (najnovšia hodina), počet sčítačov a hodinových záznamov |
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
pipeline/refresh.py   denná aktualizácia na serveri: build z API, kontroly, výmena súborov
api/data.py           načítanie parquet súborov a dotazy nad nimi
api/schemas.py        tvar JSON odpovedí (Pydantic modely)
api/main.py           FastAPI endpointy
frontend/             React (Vite + TypeScript): mapa sčítačov a detail sčítača
deploy/               nasadenie na VPS: postup, systemd služby, nginx
.github/workflows/    CI a nasadenie (test pri pushe do main, prod ručne)
```

## Frontend

React aplikácia nad API (najprv spustite API, viď vyššie):

```
cd frontend
npm install
npm run dev
```

Otvorte http://localhost:5173. Mapa (`/`) ukazuje všetky sčítače. Po kliknutí na sčítač
sa otvorí detail (`/sensor/{sensor_id}`) s tromi záložkami, vybraná je v `?view=`:

- **Deň** (`day`): hodinový graf za deň z `?date=YYYY-MM-DD`
- **Typický týždeň** (`week`): heatmapa priemeru za hodinu podľa dňa v týždni, s prepínačom smeru
- **Mesiace** (`months`): priemer za deň v každom mesiaci histórie a priemery podľa kalendárneho mesiaca

Šípkami v hlavičke detailu sa dá prejsť na predchádzajúci / ďalší sčítač.
Adresa API je v `frontend/src/config.json` (`localUrl` pri vývoji, `serverUrl` v produkcii).
Pätička na každej stránke uvádza autora a zdroj dát s licenciou (CC BY 4.0), texty a odkazy sú v `frontend/src/Models/Constants.ts`.

## Nasadenie

Frontend aj API bežia na jednom VPS za nginx na https://chodci.oresky.sk: nginx servuje
zbuildovaný React a požiadavky na `/api` posiela na uvicorn (služba systemd).
Nasadzuje GitHub Actions: každý push do `main` prejde kontrolami (lint, build, smoke test API)
a nasadí sa na https://test.chodci.oresky.sk. Na produkciu ide ten istý commit ručným
spustením workflow. Postup a konfiguračné súbory sú v [`deploy/`](deploy/README.md).

## Autor a licencia

Adam Oreský. Kód je pod licenciou MIT, viď [`LICENSE`](LICENSE). Dáta poskytuje Hlavné mesto SR Bratislava
pod licenciou [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), viď [Dáta](#dáta).
