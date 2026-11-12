# Nasadenie na VPS

Všetko beží na jednom VPS (Contabo, Ubuntu 24.04), produkcia na https://chodci.oresky.sk
a test na https://test.chodci.oresky.sk:

```
chodci.oresky.sk       /      statický frontend z /home/chodci/www
                       /api/  proxy na uvicorn 127.0.0.1:8000 (služba systemd chodci-api)
test.chodci.oresky.sk  /      statický frontend z /home/chodci/www-test
                       /api/  proxy na uvicorn 127.0.0.1:8001 (služba systemd chodci-api-test)
```

Frontend aj API sú na tej istej adrese, takže nepotrebujú CORS. Kód (API, pipeline, frontend)
nasadzuje GitHub Actions, viď [Nasadenie cez GitHub Actions](#nasadenie-cez-github-actions).
Ručne cez SFTP (FileZilla, `sftp://<IP>`, používateľ `chodci`) sa nahráva len prvá inštalácia
a konfiguračné súbory z tohto priečinka, príkazy sa spúšťajú cez SSH.

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
a do `data/processed/` oba súbory `.parquet` (neskôr kód nahráva GitHub Actions, dáta refresh).
Potom ako `chodci`:

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

Až keď kontroly prejdú, nahradí oba `.parquet` súbory a systemd reštartuje `chodci-api` aj `chodci-api-test`. Ak
sťahovanie alebo kontrola zlyhá, ostanú pôvodné súbory, API sa nereštartuje a služba je v stave
`failed`.

| súbor | na serveri |
|---|---|
| [`chodci-refresh.service`](chodci-refresh.service) | `/etc/systemd/system/chodci-refresh.service` |
| [`chodci-refresh.timer`](chodci-refresh.timer) | `/etc/systemd/system/chodci-refresh.timer` |

Inštalácia (raz, ako root, po nahratí `pipeline/` so súborom `refresh.py`):

```bash
systemctl daemon-reload
systemctl start chodci-refresh            # prvé spustenie trvá ~1 min
journalctl -u chodci-refresh -n 30        # musí končiť "Replaced: ..."
systemctl enable --now chodci-refresh.timer
systemctl list-timers chodci-refresh      # kedy sa spustí nabudúce
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

## Nasadenie cez GitHub Actions

Jedna vetva `main`, dve prostredia:

```
PR ▶ CI
push do main ▶ CI ▶ automatický deploy na https://test.chodci.oresky.sk 
Run workflow ▶ CI ▶ deploy na https://chodci.oresky.sk (ručne, len z main)
```

| prostredie | API | frontend | služba | port |
|---|---|---|---|---|
| test | `/home/chodci/app-test` | `/home/chodci/www-test` | `chodci-api-test` | 8001 |
| prod | `/home/chodci/app` | `/home/chodci/www` | `chodci-api` | 8000 |

Workflow sú v [`.github/workflows/`](../.github/workflows). Deploy ([`deploy.yml`](../.github/workflows/deploy.yml))
cez `rsync` nahrá `api/`, `pipeline/`, `requirements.txt`, nainštaluje závislosti (venv vytvorí,
ak chýba), reštartuje API, počká, kým odpovedá, nahrá zbuildovaný frontend a skontroluje
verejnú adresu. Priečinok `data/` nenahráva: refresh tam má novšie dáta ako tie v repozitári.
Test nemá vlastné dáta ani refresh: `app-test/data/processed` je symlink na
`app/data/processed` a refresh po výmene dát reštartuje aj `chodci-api-test`.

Frontend volá API na relatívnej adrese `/api` (`serverUrl` vo `frontend/src/config.json`),
preto rovnaký build funguje na teste aj na produkcii.

**Nasadenie na produkciu:** GitHub → *Actions* → *Deploy prod* → *Run workflow* (vetva `main`).

| súbor | na serveri |
|---|---|
| [`chodci-api-test.service`](chodci-api-test.service) | `/etc/systemd/system/chodci-api-test.service` |
| [`nginx-test.conf`](nginx-test.conf) | `/etc/nginx/sites-available/chodci-test` |
| [`sudoers-chodci-deploy`](sudoers-chodci-deploy) | `/etc/sudoers.d/chodci-deploy` |

### Prvé nastavenie (raz)

**1. DNS:** A záznam `test.chodci` pre `oresky.sk` (Websupport) na IP adresu VPS.

**2. SSH kľúč len pre deploy** (na vlastnom PC v `C:\Users\<meno>\.ssh`, nie v repozitári ani
na pracovnej ploche synchronizovanej do OneDrive):

```
ssh-keygen -t ed25519 -C "github-actions-chodci" -f chodci-deploy
```

Na otázku na passphrase dvakrát Enter (kľúč bez hesla, používa ho GitHub Actions). V PowerShell
5.1 nepoužívajte `-N ""`: prázdny argument sa nepošle. Vzniknú `chodci-deploy` (súkromný kľúč,
secret `DEPLOY_SSH_KEY`) a `chodci-deploy.pub` (verejný, na server v kroku 3).

**3. Server ako `chodci`:** verejný kľúč, adresáre pre test a symlink na dáta produkcie.

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo '<obsah chodci-deploy.pub>' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
mkdir -p ~/app-test/data ~/www-test
ln -s /home/chodci/app/data/processed ~/app-test/data/processed
```

**4. Server ako root:** konfiguračné súbory z tabuľky vyššie (nahrajte ich cez SFTP do
`/home/chodci` a skopírujte), aj aktualizovaný [`chodci-refresh.service`](chodci-refresh.service).

```bash
cp /home/chodci/chodci-api-test.service /home/chodci/chodci-refresh.service /etc/systemd/system/
cp /home/chodci/nginx-test.conf /etc/nginx/sites-available/chodci-test
install -m 440 /home/chodci/sudoers-chodci-deploy /etc/sudoers.d/chodci-deploy
visudo -cf /etc/sudoers.d/chodci-deploy  # musí vypísať "parsed OK"
systemctl daemon-reload
systemctl enable chodci-api-test         # spustí ho až prvý deploy (zatiaľ nemá kód)
ln -s /etc/nginx/sites-available/chodci-test /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d test.chodci.oresky.sk
free -h                                  # dve API = dvakrát dáta v pamäti
```

**5. GitHub** (repozitár → *Settings*):

- *Secrets and variables → Actions → New repository secret*:
  - `DEPLOY_HOST`: IP adresa VPS,
  - `DEPLOY_SSH_KEY`: celý obsah súboru `chodci-deploy` (súkromný kľúč),
  - `DEPLOY_KNOWN_HOSTS`: riadok `<IP> ssh-ed25519 AAAA… root@…`, teda IP adresa, medzera
    a výstup príkazu nižšie (po kroku 3, keď už kľúč funguje):

    ```
    ssh -i chodci-deploy chodci@<IP> "cat /etc/ssh/ssh_host_ed25519_key.pub"
    ```

    `ssh-keyscan` z Windowsu nefunguje: starší OpenSSH vo Windowse nepozná metódu výmeny
    kľúčov servera (`choose_kex: unsupported KEX method sntrup761x25519-sha512@openssh.com`).
- *Environments*: vytvorte `test` a `prod`. Pri `prod` nastavte *Deployment branches and tags*
  → *Selected branches* → `main`. Voliteľne *Required reviewers* (seba), potom deploy na
  produkciu čaká na schválenie.

**6. Kontrola:** push do `main` (alebo *Actions → Deploy test → Re-run*), potom
https://test.chodci.oresky.sk a https://test.chodci.oresky.sk/api/status. Prvé spustenie
*Deploy prod* prepíše ručne nahraté súbory na produkcii tými istými z `main`.

## Ďalšie nasadenia

| zmena | čo urobiť |
|---|---|
| kód API, frontend, `requirements.txt` | push do `main` → test; potom *Run workflow* → prod |
| nové dáta | nič, aktualizujú sa samé každý deň; mimo plánu `systemctl start chodci-refresh` |
| súbory v `deploy/` (systemd, nginx) | ručne cez SFTP + SSH ako root, deploy ich nenahráva |

API načíta dáta do pamäte pri štarte, preto je po zmene dát potrebný reštart. Refresh ho robí
sám, ručne len pri dátach nahratých inak: `systemctl restart chodci-api chodci-api-test`.

Logy: `journalctl -u chodci-api -n 50` (API), `journalctl -u chodci-api-test -n 50` (test),
`journalctl -u chodci-refresh -n 50` (refresh), `/var/log/nginx/error.log` (nginx).
