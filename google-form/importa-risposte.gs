/**
 * Guest book — da risposte del Modulo a content.json (Google Apps Script).
 *
 * Trasforma le risposte del Modulo creato con crea-modulo.gs in un file
 * content.json (lo stesso che mangia build.py) e lo salva in una cartella
 * del tuo Google Drive. Tutto dentro Google: niente passaggi locali.
 *
 * COME SI USA
 *   1. Apri lo STESSO progetto Apps Script del modulo (script.google.com).
 *   2. Aggiungi un file (＋ → Script) e incolla TUTTO questo contenuto.
 *   3. Esegui una volta la funzione che preferisci:
 *        • esportaUltima()      → l'ultima risposta ricevuta → un content.json
 *        • esportaTutte()       → tutte le risposte → un file ciascuna
 *        • installaTrigger()    → (opzionale) genera il content.json AUTOMATICAMENTE
 *                                  a ogni nuovo invio del cliente
 *   4. Autorizza (serve l'accesso al Modulo e a Drive).
 *   5. Trovi i file nella cartella Drive "Guestbook — content" (link nei Log).
 *
 * NOTE
 *   • lat/lng vengono ricavate dall'indirizzo via geocoding (servizio Maps di
 *     Apps Script). Se fallisce, restano nulle e la mappa viene semplicemente omessa.
 *   • Le sezioni che prepariamo noi (cosa fare / trasporti / numeri d'emergenza) NON
 *     vengono inventate: restano da completare. Le risposte “grezze” utili (esperienza
 *     da promuovere, consigli, link foto, scelta logo) finiscono in `_intake`, che
 *     build.py ignora ma a noi serve come promemoria.
 *   • Le immagini usano nomi convenzionali (host.jpg, apt-kitchen.jpg, apt-01.jpg…):
 *     scarichiamo le foto dal link del cliente, le rinominiamo così e le mettiamo in
 *     input/photos/. Finché non ci sono, build.py avvisa (è normale per la bozza).
 */

var FORM_ID = '';                              // opzionale: id del modulo (.../d/<ID>/edit). Vuoto = ricerca per nome.
var FORM_NAME = 'Il tuo guest book digitale — raccolta dati';
var OUTPUT_FOLDER = 'Guestbook — content';

// ───────────────────────── funzioni principali ─────────────────────────

function esportaUltima() {
  var responses = openForm().getResponses();
  if (!responses.length) { Logger.log('Nessuna risposta ancora.'); return; }
  var url = scriviContent(responses[responses.length - 1]);
  Logger.log('✅ content.json salvato: ' + url);
}

function esportaTutte() {
  var responses = openForm().getResponses();
  if (!responses.length) { Logger.log('Nessuna risposta ancora.'); return; }
  for (var i = 0; i < responses.length; i++) {
    Logger.log((i + 1) + '/' + responses.length + '  →  ' + scriviContent(responses[i], i + 1));
  }
}

/** Opzionale: genera il content.json a ogni nuovo invio del modulo. */
function installaTrigger() {
  var form = openForm();
  // evita doppioni
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onInvioModulo') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onInvioModulo').forForm(form).onFormSubmit().create();
  Logger.log('✅ Trigger automatico installato: ogni invio creerà un content.json in Drive.');
}

function onInvioModulo(e) {
  if (e && e.response) { scriviContent(e.response); }
}

// ───────────────────────── costruzione content.json ─────────────────────────

function scriviContent(formResponse, idx) {
  var ans = answersOf(formResponse);
  var content = buildContent(ans);
  var name = slug(content.site.businessName || 'guestbook')
           + (content.site.unitLabel ? '-' + slug(content.site.unitLabel) : '')
           + (idx ? '-' + idx : '') + '.json';
  return writeJson(content, name);
}

function buildContent(ans) {
  var biz   = get(ans, 'nome della struttura');
  var unit  = get(ans, 'etichetta di questa');
  var addr  = get(ans, 'indirizzo completo');
  var phone = get(ans, 'telefono');
  var wa    = digits(get(ans, 'whatsapp')) || digits(phone);
  var geo   = geocode(addr);

  var content = {
    site: {
      businessName: biz,
      description: 'La guida digitale per gli ospiti di ' + biz +
                   ' — check-in, Wi-Fi, info utili e consigli locali.',
      baseUrl: '',                              // da impostare alla pubblicazione
      theme: mapTheme(get(ans, 'tema del guest book')),
      tagline: get(ans, 'frase di benvenuto') || 'Enjoy your stay!',
      logoLight: 'logo-light.png',
      logoDark: 'logo-dark.png'
    },
    brand: { fontDisplay: 'Playfair Display', fontBody: 'Poppins',
             fontAccent: 'Sacramento', radius: '16px' },
    address: { text: addr, full: addr, lat: geo.lat, lng: geo.lng },
    host: {
      name: get(ans, "nome dell'host"),
      phone: phone,
      whatsapp: wa,
      // photo: si assegna guardando le foto reali (nome originale, nessuna rinomina)
      quote: get(ans, 'una frase che ti rappresenta'),
      bio: paras(get(ans, 'breve presentazione'))
    },
    checkin: {
      from: get(ans, 'check-in dalle'),
      to: get(ans, 'check-out entro'),
      selfCheckin: lines(get(ans, 'come si entra')),
      onDeparture: lines(get(ans, 'alla partenza'))
    },
    wifi: {
      ssid: get(ans, 'nome rete'),
      password: get(ans, 'wi-fi · password') || get(ans, 'password')
    }
  };
  if (unit) { content.site.unitLabel = unit; }

  var yrs = parseInt(get(ans, 'da quanti anni'), 10);
  if (!isNaN(yrs)) { content.host.yearsHosting = yrs; }

  var keyCode = get(ans, 'codice cassetta'); if (keyCode) content.checkin.keyBoxCode = keyCode;
  var keyNote = get(ans, 'note sulle chiavi'); if (keyNote) content.checkin.keyNote = keyNote;
  var wifiNote = get(ans, 'wi-fi · nota');     if (wifiNote) content.wifi.note = wifiNote;

  // ---- house info (solo voci compilate) ----
  var infoItems = [];
  pushInfo(infoItems, 'park',   'Parking',             get(ans, 'parcheggio'));
  pushInfo(infoItems, 'temp',   'Temperature',         get(ans, 'climatizzazione'));
  pushInfo(infoItems, 'washer', 'Laundry service',     get(ans, 'lavanderia'));
  pushInfo(infoItems, 'trash',  'Trash & recycling',   get(ans, 'rifiuti'));
  pushInfo(infoItems, 'house',  'Good to know',        get(ans, 'altre dotazioni'));
  pushInfo(infoItems, 'phone',  'Useful contacts',     get(ans, 'contatti utili'));
  if (infoItems.length) { content.houseInfo = { items: infoItems }; }

  // ---- kitchen ----
  var amen = asArray(get(ans, 'dotazioni della cucina'));
  var kNote = get(ans, 'cucina · nota');
  if (amen.length || kNote) {
    content.kitchen = {
      // image: si assegna guardando le foto reali
      lead: 'Make yourself completely at home.',
      intro: 'The kitchen is fully equipped — help yourself to whatever you need.',
      amenities: amen
    };
    if (kNote) { content.kitchen.coffeeNote = kNote; }
  }

  // ---- rules (le 2 foto si assegnano guardando le foto reali) ----
  var rules = lines(get(ans, 'regole della casa'));
  if (rules.length) { content.rules = { images: [], list: rules }; }

  // ---- emergency (112 + primo soccorso dal cliente; i contatti li aggiungiamo noi) ----
  var firstAid = get(ans, 'primo soccorso');
  content.emergency = { euNumber: '112', items: [] };
  if (firstAid) { content.emergency.firstAidNote = firstAid; }

  // ---- things to do: SOLO l'esperienza del cliente in evidenza (il resto lo aggiungiamo noi) ----
  var exp = get(ans, 'esperienza o un servizio');
  if (exp) {
    content.thingsToDo = { groups: [{
      id: 'ttd-exp', label: 'Experiences', title: 'Experiences',
      items: [{ featured: true, category: 'Esperienza', title: 'La nostra esperienza', desc: exp }]
    }] };
  }

  // ---- faq / reviews (se forniti) ----
  var faq = parseFaq(get(ans, 'domande frequenti'));
  if (faq.length) { content.faq = { items: faq }; }
  var rev = parseReviews(get(ans, 'recensioni da mostrare'));
  if (rev.length) { content.reviews = { items: rev, closing: 'Thank you!' }; }

  // ---- foto: nomi decisi dopo aver scaricato dal link; restano vuoti nella bozza ----
  content.collage = [];
  content.gallery = [];

  // ---- promemoria interno (build.py lo ignora) ----
  content._intake = {
    inviato: formResponseStamp(),
    logo: get(ans, 'hai un logo'),
    fotoLink: get(ans, 'link alle foto'),
    fotoPreferite: get(ans, '3 foto preferite'),
    consigliDelCliente: get(ans, 'posti del cuore'),
    preferenzeStile: get(ans, 'preferenze di stile'),
    daCompletareDaNoi: ['assegnare le foto guardandole — NIENTE rinomina (host, cucina, regole, gallery, collage)',
                        'thingsToDo (ricerca zona)', 'transport', 'emergency.items',
                        'nearest', 'eat', 'site.baseUrl']
  };
  return content;
}

// ───────────────────────── helper ─────────────────────────

function openForm() {
  if (FORM_ID) { return FormApp.openById(FORM_ID); }
  var files = DriveApp.getFilesByName(FORM_NAME);
  if (files.hasNext()) { return FormApp.openById(files.next().getId()); }
  throw new Error('Modulo non trovato. Imposta FORM_ID in alto, o verifica FORM_NAME.');
}

function answersOf(formResponse) {
  var map = {};
  formResponse.getItemResponses().forEach(function (ir) {
    map[ir.getItem().getTitle()] = ir.getResponse();
  });
  map.__submitted = formResponse.getTimestamp();
  return map;
}

function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim(); }

/** Primo valore la cui domanda contiene il pezzo di testo cercato (robusto a piccole modifiche dei titoli). */
function get(ans, needle) {
  needle = norm(needle);
  for (var k in ans) {
    if (k === '__submitted') { continue; }
    if (norm(k).indexOf(needle) >= 0) {
      var v = ans[k];
      return Array.isArray(v) ? v.join(', ') : String(v == null ? '' : v).trim();
    }
  }
  return '';
}

function asArray(v) {
  if (!v) { return []; }
  if (Array.isArray(v)) { return v; }
  return String(v).split(',').map(function (x) { return x.trim(); }).filter(String);
}
function lines(v) { return String(v || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(String); }
function paras(v) {
  var out = String(v || '').split(/\r?\n\s*\r?\n/).map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(String);
  return out.length ? out : (String(v || '').trim() ? [String(v).trim()] : []);
}
function digits(v) { return String(v || '').replace(/[^0-9]/g, ''); }
function slug(v) {
  return String(v || '').toLowerCase().replace(/[àáâ]/g, 'a').replace(/[èé]/g, 'e').replace(/[ìí]/g, 'i')
    .replace(/[òó]/g, 'o').replace(/[ùú]/g, 'u').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function pushInfo(arr, icon, title, body) { if (body) { arr.push({ icon: icon, title: title, body: body }); } }

function mapTheme(v) {
  v = norm(v);
  if (v.indexOf('chiaro') >= 0) { return 'light'; }
  if (v.indexOf('autom') >= 0) { return 'auto'; }
  return 'dark';   // "Scuro" o "Scegliete voi" → stile della casa
}

function parseReviews(v) {
  return lines(v).map(function (line) {
    var m = line.match(/[«"“](.+?)[»"”]\s*[—\-]\s*(.+)$/);
    if (m) { return { stars: 5, text: m[1].trim(), author: m[2].trim() }; }
    var m2 = line.match(/^(.+?)\s*[—\-]\s*([^—\-]+)$/);
    if (m2) { return { stars: 5, text: m2[1].trim(), author: m2[2].trim() }; }
    return { stars: 5, text: line };
  });
}

function parseFaq(v) {
  var out = [], cur = null;
  lines(v).forEach(function (line) {
    var d = line.match(/^d\s*[:.\-]\s*(.+)$/i);
    var r = line.match(/^r\s*[:.\-]\s*(.+)$/i);
    if (d) { if (cur && cur.q) { out.push(cur); } cur = { q: d[1].trim(), a: '' }; }
    else if (r) { if (!cur) { cur = { q: '', a: '' }; } cur.a = r[1].trim(); }
    else if (cur) { (cur.a ? cur.a += ' ' + line : cur.q += ' ' + line); }
  });
  if (cur && cur.q) { out.push(cur); }
  return out.filter(function (x) { return x.q && x.a; });
}

function geocode(addr) {
  try {
    var res = Maps.newGeocoder().geocode(addr);
    if (res && res.results && res.results.length) {
      var loc = res.results[0].geometry.location;
      return { lat: Math.round(loc.lat * 1e7) / 1e7, lng: Math.round(loc.lng * 1e7) / 1e7 };
    }
  } catch (e) { Logger.log('Geocoding fallito: ' + e); }
  return { lat: null, lng: null };
}

function writeJson(content, name) {
  var folder = getFolder(OUTPUT_FOLDER);
  // un file per nome: se esiste lo aggiorno, così non si accumulano doppioni
  var existing = folder.getFilesByName(name);
  var json = JSON.stringify(content, null, 2);
  if (existing.hasNext()) { var f = existing.next(); f.setContent(json); return f.getUrl(); }
  return folder.createFile(name, json, MimeType.PLAIN_TEXT).getUrl();
}

function getFolder(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function formResponseStamp() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'); }
