/**
 * Guest book — generatore del modulo di raccolta dati cliente (Google Apps Script).
 *
 * COME SI USA
 *   1. Vai su https://script.google.com  →  "Nuovo progetto".
 *   2. Cancella il contenuto e incolla TUTTO questo file.
 *   3. In alto seleziona la funzione  creaModulo  e premi ▶ Esegui.
 *   4. Autorizza l'accesso (è il tuo account: serve a creare il Form).
 *   5. Menu  Visualizza → Log (o Esecuzioni): troverai due link
 *        • EDIT  → per modificare il modulo
 *        • LIVE  → da inviare al cliente
 *
 * Le risposte si raccolgono in un Foglio Google (Modulo → Risposte → collega a Sheets):
 * da lì le trascriviamo in content.json. La mappatura campo→content.json è annotata
 * accanto a ogni sezione qui sotto.
 */

function creaModulo() {
  var form = FormApp.create('Il tuo guest book digitale — raccolta dati')
    .setDescription(
      'Con queste informazioni realizziamo la tua guida digitale per gli ospiti ' +
      '(check-in, Wi-Fi, regole, consigli sul territorio…).\n\n' +
      'Rispondere è veloce. Dove non sai cosa scrivere lascia in bianco: ci pensiamo noi.\n' +
      'Legenda:  ✅ ci serve   ·   ⚪️ facoltativo   ·   🔎 lo prepariamo noi.')
    .setProgressBar(true)
    .setAllowResponseEdits(true)
    .setConfirmationMessage(
      'Grazie! Abbiamo ricevuto le tue informazioni. ' +
      'Ti ricontattiamo con una bozza del guest book. ✨');

  // ---------- helper ----------
  function txt(title, o)  { var i = form.addTextItem().setTitle(title);          _o(i, o); return i; }
  function para(title, o) { var i = form.addParagraphTextItem().setTitle(title); _o(i, o); return i; }
  function choice(title, vals, o) { var i = form.addMultipleChoiceItem().setTitle(title).setChoiceValues(vals); _o(i, o); return i; }
  function checks(title, vals, o) { var i = form.addCheckboxItem().setTitle(title).setChoiceValues(vals); _o(i, o); return i; }
  function page(title, help)  { var p = form.addPageBreakItem().setTitle(title); if (help) p.setHelpText(help); return p; }
  function note(title, help)  { return form.addSectionHeaderItem().setTitle(title).setHelpText(help || ''); }
  function _o(item, o) {
    o = o || {};
    if (o.help) item.setHelpText(o.help);
    if (o.req && item.setRequired) item.setRequired(true);
  }

  // ═══════════════ PAGINA 1 · LA STRUTTURA ═══════════════  → site / address
  note('1 · La struttura', '✅ I campi con asterisco ci servono per forza.');
  txt('Nome della struttura (come deve comparire in alto)', { req: true });          // site.businessName
  txt('Hai più unità? Etichetta di questa (es. “Apt 1”, “Vista Mare”)',
      { help: '⚪️ Lascia vuoto se gestisci un solo alloggio.' });                    // site.unitLabel
  txt('Indirizzo completo (via, civico, CAP, città)', { req: true });                // address.text / full
  txt('Link Google Maps esatto del portone',
      { help: '⚪️ Utile se l’indirizzo è ambiguo; altrimenti lo troviamo noi.' }); // address.lat/lng
  txt('Frase di benvenuto', { help: '⚪️ Default: “Enjoy your stay!”' });             // site.tagline
  choice('Hai un logo?', ['Sì, lo allego/invio', 'No, fatelo voi'],
      { help: '⚪️ Se sì, mandacelo insieme alle foto.' });                          // template/assets/img/logo-*

  // ═══════════════ PAGINA 2 · L'HOST ═══════════════  → host
  page('2 · L’host (chi accoglie)', 'Così gli ospiti sanno chi c’è dietro l’accoglienza.');
  txt('Nome dell’host', { req: true });                                          // host.name
  txt('Da quanti anni ospiti / lavori nell’ospitalità',
      { help: '⚪️ Es. “10”. Mostriamo “10+ anni di esperienza”.' });                // host.yearsHosting
  txt('Telefono (per chiamate)', { req: true });                                     // host.phone
  txt('Numero WhatsApp (se diverso dal telefono)', { help: '⚪️' });                 // host.whatsapp
  txt('Una frase che ti rappresenta',
      { help: '⚪️ Es. “Per me l’ospitalità non è un lavoro, è un piacere.”' }); // host.quote
  para('Breve presentazione (3-4 righe: chi sei, la tua idea di accoglienza)', { help: '⚪️' }); // host.bio
  para('Foto dell’host — link o conferma che la invierai',
      { help: 'Ritratto. Allegala con le altre foto (vedi ultima pagina).' });       // host.photo

  // ═══════════════ PAGINA 3 · ACCESSO & WI-FI ═══════════════  → checkin / wifi
  page('3 · Accesso & Wi-Fi', 'Le info più importanti per l’arrivo.');
  txt('Check-in dalle ore', { req: true, help: 'Es. 14:00' });                        // checkin.from
  txt('Check-out entro le ore', { req: true, help: 'Es. 10:00' });                    // checkin.to
  para('Come si entra (istruzioni passo-passo)',
      { req: true, help: 'Una riga per passo: portone, piano, ascensore, dove sta la cassetta chiavi…' }); // checkin.selfCheckin
  txt('Codice cassetta chiavi / serratura', { help: '⚪️ Se previsto.' });            // checkin.keyBoxCode
  txt('Note sulle chiavi', { help: '⚪️ Es. “chiave piccola per l’ascensore”.' }); // checkin.keyNote
  para('Cosa chiedi all’ospite alla partenza',
      { help: 'Una riga ciascuno: spegnere AC/luci, chiudere finestre, dove lasciare chiavi e tassa di soggiorno, avvisare…' }); // checkin.onDeparture
  txt('Wi-Fi · Nome rete (SSID)', { req: true });                                     // wifi.ssid
  txt('Wi-Fi · Password', { req: true });                                             // wifi.password
  txt('Wi-Fi · Nota', { help: '⚪️ Es. “se non funziona, scrivimi”.' });             // wifi.note

  // ═══════════════ PAGINA 4 · LA CASA ═══════════════  → houseInfo / kitchen / rules
  page('4 · La casa', '⚪️ Compila solo ciò che ti riguarda.');
  para('Parcheggio (dove, gratuito o a pagamento, distanza)');                        // houseInfo
  para('Climatizzazione / riscaldamento (dove sono i comandi, istruzioni)');          // houseInfo
  para('Lavanderia (in casa o nelle vicinanze, orari)');                              // houseInfo
  para('Rifiuti / differenziata (giorni, orari, dove conferire)',
      { help: 'Se hai il calendario della raccolta, allegalo con le foto.' });        // houseInfo (+ image)
  para('Altre dotazioni o istruzioni (boiler, citofono, ascensore…)');                // houseInfo
  checks('Dotazioni della cucina',
      ['Forno', 'Piano cottura', 'Frigo', 'Macchina caffè', 'Lavastoviglie', 'Bollitore', 'Tostapane']); // kitchen.amenities
  txt('Cucina · nota', { help: '⚪️ Es. “caffè, tè e zucchero a disposizione”.' });   // kitchen.coffeeNote
  para('Regole della casa',
      { help: 'Una per riga: orari di silenzio, feste, fumo, animali…' });            // rules.list

  // ═══════════════ PAGINA 5 · EMERGENZE & TERRITORIO ═══════════════  → emergency / thingsToDo
  page('5 · Emergenze & dintorni',
       '🔎 Numeri utili e consigli sul territorio li prepariamo noi. Tu indicaci solo questo:');
  txt('C’è una cassetta di primo soccorso? Dove?', { help: '⚪️' });             // emergency.firstAidNote
  txt('Contatti utili della struttura (amministratore, manutentore…)', { help: '⚪️' });
  para('Hai un’esperienza o un servizio TUO da promuovere?',
      { help: '⭐ La mettiamo in evidenza. Es. tour in barca, degustazione, transfer…' }); // thingsToDo featured
  para('Posti del cuore che vuoi assolutamente consigliare',
      { help: '⚪️ Ristoranti, attività… li integriamo alla nostra ricerca.' });      // thingsToDo / eat

  // ═══════════════ PAGINA 6 · RECENSIONI & FAQ ═══════════════  → reviews / faq
  page('6 · Recensioni & domande frequenti', '⚪️ Tutto facoltativo, ma rende la guida più ricca.');
  para('Recensioni da mostrare',
      { help: 'Una per riga: «testo» — provenienza (es. Booking, Airbnb).' });        // reviews.items
  para('Domande frequenti dei tuoi ospiti (con risposta)',
      { help: 'Formato: D: … / R: …' });                                              // faq.items

  // ═══════════════ PAGINA 7 · FOTO, ASPETTO & INVIO ═══════════════  → gallery / brand / site.theme
  page('7 · Foto, aspetto & invio', 'Quasi finito!');
  para('Link alle foto (Google Drive / WeTransfer)',
      { req: true,
        help: '6-9 foto dell’alloggio: zona giorno, camere, bagno, terrazza/esterni. ' +
              'Orizzontali, luminose, alta risoluzione (no screenshot). Includi logo e foto host se ce li hai.' }); // gallery
  txt('Le 3 foto preferite per la copertina',
      { help: '⚪️ Indica i nomi file (es. terrazza.jpg, soggiorno.jpg, camera.jpg).' }); // collage
  choice('Tema del guest book',
      ['Chiaro', 'Scuro', 'Automatico (segue il telefono dell’ospite)', 'Scegliete voi']); // site.theme
  txt('Preferenze di stile / colore', { help: '⚪️' });                               // brand

  // ---------- link finali nei log ----------
  Logger.log('✅ Modulo creato.');
  Logger.log('EDIT  (modifica):  ' + form.getEditUrl());
  Logger.log('LIVE  (al cliente): ' + form.getPublishedUrl());
}
