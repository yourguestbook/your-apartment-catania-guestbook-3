# Avvio di un nuovo guest book — runbook

> **Questo file è il punto di partenza per UN progetto cliente.**
> In una chat nuova puoi dire all'assistente:
> *“Nuovo guest book: ho duplicato la factory in questa cartella e ho messo `content.json`
> (dall'importer) + le foto in `input/photos/`. Segui AVVIO-PROGETTO.md.”*
>
> Dettaglio dei campi → `GUIDA.md`. Modulo/importer → `google-form/README.md`.

**Prerequisiti:** `python3` (3.8+). Opzionale `cwebp` (Homebrew: `brew install webp`) per le
versioni WebP delle foto. Nessun'altra dipendenza.

---

## Fase 1 — Duplica la factory e dalle il nome

Dalla cartella `your-apartment-guestbook-factory`:

```bash
./nuovo-progetto.sh your-apartment-<cliente>     # es. your-apartment-roma
cd ../your-apartment-<cliente>
```

Convenzione nome: `your-apartment-<città-o-nome>` (minuscolo, trattini). Diventerà anche il
nome del repo e parte dell'URL pubblico.

## Fase 2 — Porta dentro il `content.json` del cliente

L'importer ha salvato il file su Drive, cartella **“Guestbook — content”**.
Scaricalo e mettilo nella cartella del progetto **rinominandolo esattamente** `content.json`.

> Aprilo e dai una lettura. In fondo trovi `_intake`: contiene il **link alle foto**, i
> consigli del cliente, la scelta logo e l'elenco `daCompletareDaNoi`. `_intake` è solo un
> promemoria: `build.py` lo ignora.

## Fase 3 — Foto (nessuna rinomina)

**Non serve rinominare niente.** I nomi incrementali tipo `IMG_0001.JPG` di WeTransfer vanno
benissimo: `build.py` accetta qualsiasi nome di file. L'unica regola è che il nome scritto
in `content.json` corrisponda al file in `input/photos/`.

1. Scarica lo zip dal link in `_intake.fotoLink` e **scompattalo dentro `input/photos/`** così
   com'è (nomi originali, anche maiuscoli).
2. **Fai assegnare le foto all'assistente in chat**: lui le guarda e scrive lui le voci in
   `content.json` — quale foto è cucina/host/regole, i **6–9** scatti della **`gallery`** in ordine
   (zona giorno → camere → bagno) e i **3** della **`collage`** (terrazza/esterno come prima, grande).
   Tu non tocchi né i nomi né gli array.

   *Prompt utile:* “Le foto del cliente sono in `input/photos/` con nomi originali. Guardale e
   compila `gallery`, `collage`, `host.photo`, `kitchen.image` e `rules.images` in `content.json`,
   usando i nomi file così come sono.”

3. Se preferisci farlo a mano: in `content.json`
   - **`gallery`** = lista ordinata, es. `[{"file":"IMG_0042.JPG","alt":"Soggiorno"}, …]`
   - **`collage`** = 3 foto (la **prima** è quella grande)
   - **`host.photo`**, **`kitchen.image`**, **`rules.images`** = i rispettivi nomi file.

> Le foto delle attrazioni locali (`thingsToDo`) le aggiungiamo noi in fase di ricerca: si
> possono mettere in `input/photos/` con qualsiasi nome e citarle nel relativo `image`.

## Fase 4 — Completa le sezioni che curiamo noi

Nel `content.json` queste sono assenti o minime (vedi `_intake.daCompletareDaNoi`). Le
compiliamo con una ricerca sull'indirizzo (un assistente in chat può aiutare a redigerle):

- **`thingsToDo`** — gruppi *Experiences / In the city / By the sea* (l'eventuale esperienza
  del cliente è già lì come `featured`). Foto attrazioni: `ttd-<nome>.jpg` in `input/photos/`.
- **`transport`** — mezzi e collegamenti della zona.
- **`emergency.items`** — numeri utili: 118/medico, 115/pompieri, 113/polizia, ospedale e
  farmacia più vicini (con link mappa). Il 112 e l'eventuale primo soccorso ci sono già.
- **`nearest`**, **`eat`** — servizi vicini e dove mangiare.
- Verifica **`address.lat`/`lng`** (geocodati): apri la mappa e controlla che il pin sia giusto.

Struttura esatta di ogni sezione → `GUIDA.md` e `content.example.json` (esempio reale completo).

## Fase 5 — Impostazioni finali

In `content.json` → `site`:
- **`theme`**: `auto | light | dark` (l'importer l'ha già impostato dalla risposta del cliente).
- **`baseUrl`**: l'URL pubblico, da impostare ora che sai il nome repo, es.
  `https://mastropino.github.io/your-apartment-<cliente>/` (con la **/** finale).

## Fase 6 — Genera e controlla in anteprima

```bash
python3 build.py content.json          # → dist/
```
`build.py` valida i campi obbligatori e segnala foto mancanti. Per vedere il risultato servi
`dist/` in locale (richiede un server perché usa mappa e fetch):

```bash
python3 -m http.server 8000 --directory dist
# apri http://localhost:8000
```
Controlla: home (logo, collage, mappa), sezioni, galleria, tema chiaro/scuro.

## Fase 7 — Pubblica su GitHub Pages

Pubblichiamo dalla cartella **`docs/`** (Pages → branch `main`, cartella `/docs`):

```bash
python3 build.py content.json --out docs     # build "di pubblicazione"

git init -q
git add -A
git commit -q -m "Guest book <cliente> — primo rilascio"

# crea il repo e pubblica (richiede gh CLI autenticato)
gh repo create your-apartment-<cliente> --public --source=. --remote=origin --push

# attiva Pages: Settings → Pages → Source: Deploy from a branch → main / docs
# (o via API:)
gh api -X POST repos/MastroPino/your-apartment-<cliente>/pages \
  -f "source[branch]=main" -f "source[path]=/docs" 2>/dev/null || true
```

Dopo 1–2 minuti il sito è online su `https://mastropino.github.io/your-apartment-<cliente>/`.
Genera il **QR** di quell'URL e consegnalo al cliente.

> Aggiornamenti futuri: modifichi `content.json` (o le foto) → `python3 build.py content.json --out docs`
> → `git commit` + `git push`. Pages si aggiorna da solo.

## Checklist finale

- [ ] `content.json` valido (build senza errori)
- [ ] nessuna foto mancante nei log del build
- [ ] mappa col pin corretto
- [ ] sezioni locali (cosa fare / trasporti / emergenze / dintorni) compilate
- [ ] `site.baseUrl` impostato → anteprime social corrette
- [ ] sito online + QR consegnato
