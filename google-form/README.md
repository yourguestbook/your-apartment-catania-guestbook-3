# Modulo Google per la raccolta dati cliente

`crea-modulo.gs` è uno **Google Apps Script** che genera l'intero modulo
(le stesse domande di `../RACCOLTA-DATI-CLIENTE.md`, in 7 pagine guidate).

## Crearlo (una volta)

1. Apri **https://script.google.com** → **Nuovo progetto**.
2. Cancella il codice di esempio e **incolla tutto** `crea-modulo.gs`.
3. In alto scegli la funzione **`creaModulo`** → **▶ Esegui**.
4. **Autorizza** (è il tuo account: serve solo a creare il Form a tuo nome).
5. Apri **Visualizza → Log** (o la scheda *Esecuzioni*): trovi due link
   - **EDIT** → per ritoccare il modulo a mano;
   - **LIVE** → quello da **inviare al cliente** (anche come QR).

> Rilanciando `creaModulo` si crea un modulo **nuovo** ogni volta (utile come template
> per ogni cliente). Per modificarne uno esistente, usa il link EDIT.

## Raccogliere le risposte

Nel Form: scheda **Risposte → Collega a Fogli**. Ogni invio diventa una riga del
Foglio Google. Da lì trascriviamo i valori in `content.json` (la mappatura campo →
chiave è annotata accanto a ogni sezione dentro `crea-modulo.gs`).

Le **foto** arrivano come link (Drive/WeTransfer): le scarichiamo in `input/photos/`
con i nomi attesi dal `content.json` e lanciamo `python3 build.py`.

## Da risposte a `content.json` — `importa-risposte.gs`

Trasforma le risposte del modulo in un `content.json` (quasi pronto) salvato in una
cartella di Drive. **Tutto dentro Google.**

1. Apri lo **stesso progetto** Apps Script del modulo → **＋ → Script** → incolla
   `importa-risposte.gs`.
2. Esegui una funzione (e autorizza Modulo + Drive + Maps):
   - **`esportaUltima()`** — l'ultima risposta → un `content.json`;
   - **`esportaTutte()`** — tutte le risposte → un file ciascuna;
   - **`installaTrigger()`** — *(opzionale)* genera il JSON **automaticamente** a ogni nuovo invio.
3. I file finiscono nella cartella Drive **“Guestbook — content”** (il link è nei Log).

Cosa fa in automatico:
- ricava **lat/lng** dall'indirizzo (geocoding Maps) → mappa pronta;
- mappa orari, Wi-Fi, regole, info casa, cucina, host, FAQ, recensioni;
- mette l'esperienza del cliente come card **featured**;
- salva le risposte “grezze” da rielaborare in `_intake` (link foto, consigli, logo…).

Cosa resta a noi prima di pubblicare (annotato in `_intake.daCompletareDaNoi`):
- scaricare le foto dal link, **rinominarle** (`host.jpg`, `apt-kitchen.jpg`, `apt-01.jpg`…) e metterle in `input/photos/`;
- compilare le sezioni di ricerca (**cosa fare, trasporti, numeri d'emergenza, nei dintorni, dove mangiare**);
- impostare `site.baseUrl` all'atto della pubblicazione.

### Il ciclo completo
```
Modulo (LIVE) → cliente compila → Drive: content.json (importa-risposte.gs)
   → scarico in content.json + foto in input/photos/ → python3 build.py → dist/ → pubblico
```

## Note

- Niente caricamento file nativo del Form: usiamo un **link** alle foto, così il cliente
  non è costretto ad avere un account Google. (Si può attivare `addFileUploadItem`, ma
  obbliga il login Google e funziona solo in Workspace.)
- Le sezioni *Cosa fare / Trasporti / Emergenze* non sono nel modulo: le **prepariamo noi**
  dall'indirizzo. Al cliente chiediamo solo l'eventuale esperienza da promuovere (⭐) e i
  suoi consigli del cuore.
