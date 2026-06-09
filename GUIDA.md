# Guestbook Factory

Genera un *digital guest book* statico (come quelli di Catania e Malta) a partire
da un singolo file dati `content.json`. Nessuna dipendenza: serve solo **Python 3.8+**.
Se nel sistema è presente `cwebp`, le foto vengono ottimizzate anche in WebP.

```
your-apartment-guestbook-factory/
├── build.py                 # il generatore
├── content.example.json     # esempio COMPLETO (dati Catania) — la documentazione viva
├── GUIDA.md                 # questo file
├── input/photos/            # ⬅️ qui mettiamo le foto del cliente (jpg/png)
├── template/                # template HTML + CSS + JS + icone (non si tocca per i contenuti)
└── dist/                    # ⬅️ OUTPUT: il guestbook pronto da pubblicare
```

## Flusso di lavoro

1. **Raccolta dati.** Dal cliente serve: nome attività, indirizzo, orari check‑in/out,
   Wi‑Fi, regole, bio host, foto. Le sezioni locali (cosa fare, trasporti, emergenze)
   le compiliamo noi dopo una ricerca sull'indirizzo — oppure le fornisce il cliente,
   con possibilità di evidenziare una sua esperienza (`"featured": true`).
2. **Compila il file dati.**
   ```bash
   cp content.example.json content.json
   # poi modifica content.json con i dati del cliente
   ```
3. **Metti le foto** referenziate da `content.json` dentro `input/photos/`
   (nomi identici a quelli scritti nel JSON).
4. **Genera il sito.**
   ```bash
   python3 build.py            # usa content.json
   # oppure:  python3 build.py content-cliente.json --out dist-cliente
   ```
5. **Pubblica.** Copia il contenuto di `dist/` in un nuovo repo / su GitHub Pages
   (o qualsiasi hosting statico). È tutto HTML/CSS/JS statico.

## Come è fatto `content.json`

Apri `content.example.json`: è un esempio completo e funzionante (i dati reali di
Catania Apt 1). Il modo più semplice è **copiarlo e sostituire i valori**.

### Campi principali

| Blocco | Cosa contiene | Obbligatorio |
|---|---|---|
| `site` | nome attività, etichetta unità, descrizione, URL pubblico, **tema**, tagline, file logo | `businessName` ✓ |
| `brand` | font e raggio degli angoli (aspetto) | no |
| `address` | indirizzo testuale, indirizzo completo (footer), **lat/lng** per la mappa | `text` ✓ |
| `host` | nome, anni di esperienza, telefono, whatsapp, foto, citazione, bio (array di paragrafi) | `name` ✓ |
| `checkin` | orari, codice key‑box, passi self check‑in, passi alla partenza, consigli | — |
| `wifi` | SSID + password (genera il QR di connessione) | — |
| `houseInfo` | lista voci (parcheggio, clima, lavanderia, rifiuti…) | — |
| `kitchen` | foto + lista dotazioni | — |
| `rules` | due foto + lista regole | — |
| `emergency` | numero unico, lista contatti, poster | — |
| `transport` | lista mezzi/collegamenti | — |
| `thingsToDo` | **gruppi** (Esperienze / In città / Al mare), ogni voce con `featured` opzionale | — |
| `nearest`, `eat`, `beforeYouGo`, `faq`, `reviews` | liste delle rispettive sezioni | — |
| `collage` | 3 foto della home (la prima è quella grande) | — |
| `gallery` | tutte le foto della galleria (in ordine) | — |

> **Sezioni opzionali:** se un blocco non è presente nel JSON, la sezione corrispondente
> viene **omessa** dal sito (eccetto host / check‑in / Wi‑Fi).

### Tema chiaro/scuro — `site.theme`

| valore | effetto |
|---|---|
| `"auto"` | segue le impostazioni del dispositivo dell'ospite (chiaro/scuro nativo) |
| `"dark"` | sempre scuro |
| `"light"` | sempre chiaro |

`build.py` adatta di conseguenza CSS (media query), colori della barra del browser,
logo (chiaro/scuro) e tile della mappa (CARTO Voyager chiaro / Dark Matter scuro).

### Aspetto — `brand`

Cambia font e raggi senza toccare il CSS:
```json
"brand": { "fontDisplay": "Playfair Display", "fontBody": "Poppins",
           "fontAccent": "Sacramento", "radius": "16px" }
```
Per palette personalizzate (avanzato) si possono passare override dei token colore in
`brand.tokens.common | light | dark` (vedi i commenti in `build.py`).

### Immagini

- Nel JSON le immagini sono **solo nomi di file** (es. `"apt-05.jpg"` **o** `"IMG_0042.JPG"`);
  i file vanno in `input/photos/`. **Qualunque nome va bene — non serve rinominare** le foto
  del cliente: basta che il nome nel JSON corrisponda al file. L'unica scelta che conta è
  *quale* foto va dove (cucina, galleria, copertina), e quella la si fa guardandole.
- `build.py` le copia in `dist/assets/img/`, genera i `.webp` (se `cwebp` c'è) e costruisce
  il manifest della galleria. In pagina viene servito il WebP, con il JPG come fallback.
- I loghi (`logo-light.png`, `logo-dark.png`), le favicon e l'`og-image.png` stanno già in
  `template/assets/img/`: sostituiscili lì per cambiare brand.

## Validazione

`build.py` controlla i campi obbligatori e la coerenza (es. `lat`/`lng` insieme, valore di
`theme`) e stampa errori chiari prima di generare. Se il JSON ha un errore di sintassi,
indica riga e colonna.

## Sintassi del template (per chi mette mano al `template/`)

Mini‑motore tipo Mustache: `{{ var }}` (con escaping), `{{{ raw }}}`,
`{{#if x}}…{{else}}…{{/if}}`, `{{#each lista}}…{{/each}}` (`{{@number}}`, `{{@first}}`…),
`{{> icons }}` per i partial. I titoli/etichette dell'interfaccia restano in inglese nel
template; solo i **dati del cliente** sono variabili.
