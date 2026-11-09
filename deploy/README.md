# Nasadenie na VPS

Všetko beží na jednom VPS (Contabo, Ubuntu 24.04) na https://chodci.oresky.sk:

```
nginx  /        statický frontend z /home/chodci/www
       /api/    proxy na uvicorn 127.0.0.1:8000 (služba systemd chodci-api)
```

Frontend aj API sú na tej istej adrese, takže produkcia nepotrebuje CORS. Súbory sa na server
nahrávajú cez SFTP (FileZilla, `sftp://<IP>`, používateľ `chodci`), príkazy sa spúšťajú cez SSH.

| súbor | na serveri |
|---|---|
| [`chodci-api.service`](chodci-api.service) | `/etc/systemd/system/chodci-api.service` |
| [`nginx.conf`](nginx.conf) | `/etc/nginx/sites-available/chodci` |

## Prvá inštalácia (raz, ako root)

A záznam `chodci` pre `oresky.sk` (Websupport) smeruje na IP adresu VPS.

```bash
apt update && apt upgrade -y
apt install -y python3 python3-venv nginx certbot python3-certbot-nginx
adduser chodci
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable   # OpenSSH najprv, inak sa odpojíte
su - chodci -c "mkdir -p ~/app/data/processed ~/www"
chmod 755 /home/chodci            # nginx musí vedieť čítať ~/www
```

Cez SFTP nahrajte do `/home/chodci/app/` priečinky `api/`, `pipeline/`, súbor `requirements.txt`
a do `data/processed/` oba súbory `.parquet`. Potom ako `chodci`:

```bash
cd ~/app
python3 -m venv .venv             # venv z Windowsu na Linuxe nefunguje
.venv/bin/pip install -r requirements.txt
```

Konfiguračné súbory z tohto priečinka skopírujte na miesta podľa tabuľky vyššie (napr. nahrajte
ich cez SFTP do `/home/chodci` a ako root presuňte cez `cp`). Potom:

```bash
systemctl daemon-reload && systemctl enable --now chodci-api
ln -s /etc/nginx/sites-available/chodci /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
certbot --nginx -d chodci.oresky.sk      # HTTPS, certifikát sa obnovuje sám
```

Kontrola: https://chodci.oresky.sk/api/sensors a https://chodci.oresky.sk/api/docs.

## Denná aktualizácia dát

Systemd timer každý deň o 03:00 (bratislavského času) spustí `python -m pipeline.refresh`.
Skript stiahne celý dataset z ArcGIS API do `data/processed/staging/` a skontroluje ho:

- dáta nie sú prázdne a všetky počty patria k známym sčítačom,
- hodinových záznamov nie je o viac ako 5 % menej ako v aktuálnych dátach,
- najnovšia hodina nie je staršia ako v aktuálnych dátach,
- nechýba žiadny sčítač z aktuálnych dát (ID sú v URL API).

Až keď kontroly prejdú, nahradí oba `.parquet` súbory a systemd reštartuje `chodci-api`. Ak
sťahovanie alebo kontrola zlyhá, ostanú pôvodné súbory, API sa nereštartuje a služba je v stave
`failed`.

| súbor | na serveri |
|---|---|
| [`chodci-refresh.service`](chodci-refresh.service) | `/etc/systemd/system/chodci-refresh.service` |
| [`chodci-refresh.timer`](chodci-refresh.timer) | `/etc/systemd/system/chodci-refresh.timer` |

Inštalácia (raz, ako root, po nahratí `pipeline/` so súborom `refresh.py`):

```bash
systemctl daemon-reload
systemctl start chodci-refresh            # prvý beh hneď, trvá ~1 min
journalctl -u chodci-refresh -n 30        # musí končiť "Replaced: ..."
systemctl enable --now chodci-refresh.timer
systemctl list-timers chodci-refresh      # kedy pobeží nabudúce
```

Kontrola: https://chodci.oresky.sk/api/status (`data_until` = najnovšia hodina v dátach).

### E-mail pri chybe (healthchecks.io)

Refresh posiela pingy na [healthchecks.io](https://healthchecks.io), ten
posiela e-mail. Upozorní, keď refresh zlyhá (aj s koncom logu) aj keď ping vôbec nepríde
(server nebeží, timer nebeží).

| súbor | na serveri |
|---|---|
| [`chodci-refresh-failed.service`](chodci-refresh-failed.service) | `/etc/systemd/system/chodci-refresh-failed.service` |

1. Na healthchecks.io vytvorte check: *Schedule* `Cron`, výraz `0 3 * * *`, časové pásmo
   `Europe/Bratislava`, *Grace time* 30 minút. Skopírujte jeho ping URL.
2. Na serveri ako root (URL nepatrí do repozitára):

   ```bash
   mkdir -p /etc/chodci
   echo 'HC_URL=https://hc-ping.com/<uuid>' > /etc/chodci/healthchecks.env
   chmod 600 /etc/chodci/healthchecks.env
   systemctl daemon-reload
   systemctl start chodci-refresh          # na healthchecks.io má byť check zelený
   ```

3. Test chyby: `systemctl start chodci-refresh-failed` pošle `/fail`, mal by prísť e-mail.
   Potom `systemctl start chodci-refresh`, aby bol check znova zelený.

## Frontend

```
cd frontend
npm run build
```

Cez SFTP zmažte obsah `/home/chodci/www/` a nahrajte doň obsah `frontend/dist/`
(`assets/`, `index.html`, `favicon.svg`). V produkcii volá frontend API na `/api`
(`serverUrl` vo `frontend/src/config.json`).

## Ďalšie nasadenia

| zmena | SFTP | SSH (root) |
|---|---|---|
| kód API | prepíšte `api/`, `pipeline/` | `systemctl restart chodci-api` |
| nové dáta | nič, aktualizujú sa samé každý deň | mimo plánu: `systemctl start chodci-refresh` |
| `requirements.txt` | nahrajte ho | `/home/chodci/app/.venv/bin/pip install -r /home/chodci/app/requirements.txt`, potom restart |
| frontend | zmažte `www/`, nahrajte nový `dist/` | nič |

API načíta dáta do pamäte pri štarte, preto je po zmene dát potrebný reštart.

Logy: `journalctl -u chodci-api -n 50` (API), `/var/log/nginx/error.log` (nginx).
