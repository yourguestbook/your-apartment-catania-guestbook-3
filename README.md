# Your Apartment — Guestbook Factory

Generatore **statico** di guest book digitali per strutture ricettive (check‑in, Wi‑Fi,
regole, mappa, consigli sul territorio…), consultabili da telefono via link/QR.

Un singolo file dati **`content.json`** + il template → un sito completo e pubblicabile in
`dist/`. **Zero dipendenze**: serve solo Python 3.8+ (`cwebp` opzionale per le foto WebP).

È lo “stampo” da cui nascono i singoli guest book: per ogni cliente si **duplica** la
cartella, si riempie il `content.json` e si pubblica.

## Avvio rapido (prova con l'esempio)

```bash
python3 build.py content.example.json     # genera dist/ con i dati demo di Catania
python3 -m http.server 8000 --directory dist
# apri http://localhost:8000
```

## Nuovo progetto cliente

```bash
./nuovo-progetto.sh your-apartment-<cliente>   # duplica la factory, pulita
cd ../your-apartment-<cliente>
# poi segui AVVIO-PROGETTO.md
```

## Come funziona

- **Aspetto** guidato da CSS variables + `site.theme` (`auto` / `light` / `dark`): il build
  adatta CSS, colore della barra browser, logo e tile della mappa.
- **Contenuti** tutti in `content.json`; le sezioni assenti vengono omesse dal sito.
- Le sezioni locali (cosa fare / trasporti / emergenze) le prepariamo noi dall'indirizzo;
  il `thingsToDo` supporta una card `featured` per l'esperienza del cliente.
- Le immagini possono avere **qualsiasi nome** (anche i `IMG_0001.JPG` di WeTransfer): basta
  che il nome nel `content.json` corrisponda al file in `input/photos/`.

## Documentazione

| File | A cosa serve |
|---|---|
| **`AVVIO-PROGETTO.md`** | runbook passo‑passo per realizzare e pubblicare un guest book |
| **`GUIDA.md`** | riferimento di tutti i campi del `content.json` |
| **`RACCOLTA-DATI-CLIENTE.md`** | questionario da far compilare al cliente |
| **`google-form/README.md`** | modulo Google (crea‑modulo) + importer risposte → `content.json` |
| **`content.example.json`** | esempio completo e funzionante (dati reali di Catania) |

## Struttura

```
build.py                 generatore (motore template stdlib + pipeline)
template/                template HTML tokenizzato + CSS + JS + icone
input/photos/            foto del progetto (qualsiasi nome)
content.example.json     esempio / contratto dati
nuovo-progetto.sh        duplica la factory per un nuovo cliente
google-form/             modulo di raccolta dati + importer (Apps Script)
dist/ · docs/            output del build (anteprima / pubblicazione)  — generati
```

## Pubblicazione

Build verso `docs/` e GitHub Pages da `main` / `docs` (vedi `AVVIO-PROGETTO.md`, Fase 7).

---

> Nota: `content.example.json` e `input/photos/` contengono i **dati demo di Catania Apt 1**
> (già pubblici sul sito live) a scopo di esempio. Sostituiscili coi dati del cliente per ogni
> nuovo progetto — o parti da una cartella pulita con `./nuovo-progetto.sh`.
