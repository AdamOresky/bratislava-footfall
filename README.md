# Bratislava footfall

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
| `counts.parquet` | ~800 tis. riadkov: hodinové počty (`sensor_id`, `timestamp` v UTC, `count_to`, `count_from`, `count`), ~6 MB |

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

## Štruktúra

```
data/raw/          surové dáta (CSV, necommitnuté, verejne stiahnuteľné)
data/processed/    výstupy pipeline (generované, necommitujú sa)
pipeline/source.py    E: načítanie dát a zjednotenie stĺpcov
pipeline/transform.py T: čisté funkcie DataFrame → DataFrame
pipeline/build.py     orchestrácia E => T => L, vstupný bod pipeline
```

## Ďalšie kroky

Dáta sa zatiaľ načítavajú z CSV. Pripravené je rozšírenie na priame sťahovanie
cez ArcGIS REST API.
