// Genera un Order ID tipo TRPLRG-082126-001-F2T
// Formato: TRPLRG-MMGGAA-NNN-SUFFISSO
//  - MMGGAA: mese/giorno/anno(2 cifre), fuso orario Europe/Rome
//  - NNN: numero progressivo del giorno (riparte da 001 ogni giorno), salvato su Netlify Blobs
//  - SUFFISSO: per ogni tipo di prodotto presente nell'ordine, in ordine alfabetico (C, F, T, V):
//    se quantità 1 -> solo la lettera (es. "F"), se quantità >1 -> numero+lettera (es. "2T")

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const LETTERS = {
  'xl-cd': 'C',
  'xl-felpa': 'F',
  'xl-maglietta': 'T',
  'xl-vinile': 'V',
};

// Su questo sito Netlify non inietta automaticamente le credenziali di Blobs
// nella function (errore "MissingBlobsEnvironmentError"), quindi le passiamo
// a mano tramite due variabili d'ambiente configurate su Netlify:
// BLOBS_SITE_ID e BLOBS_TOKEN. Se un giorno l'iniezione automatica di Netlify
// dovesse iniziare a funzionare, questa funzione continua a usare comunque
// le variabili esplicite se presenti, altrimenti torna al comportamento di default.
function getOrderCountersStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'order-counters', siteID, token });
  }
  return getStore('order-counters');
}

function datePartsRome() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  return { mm: get('month'), dd: get('day'), yy: get('year') };
}

function buildSuffix(items) {
  const qtyByLetter = {};
  for (const item of items) {
    const letter = LETTERS[item.handle];
    if (!letter) continue;
    qtyByLetter[letter] = (qtyByLetter[letter] || 0) + (Math.max(1, parseInt(item.quantity, 10) || 1));
  }
  return Object.keys(qtyByLetter)
    .sort()
    .map((letter) => (qtyByLetter[letter] === 1 ? letter : `${qtyByLetter[letter]}${letter}`))
    .join('');
}

// Legge il contatore del giorno insieme al suo etag, stesso pattern già usato
// e verificato in lib/stock.cjs. Nessun etag = chiave mai creata per oggi
// (la prima scrittura userà onlyIfNew invece di onlyIfMatch).
async function readCounterWithEtag(store, dateKey) {
  try {
    const entry = await store.getWithMetadata(dateKey, { type: 'json' });
    if (entry && typeof entry.data === 'number') {
      return { value: entry.data, etag: entry.etag };
    }
  } catch {
    // Blobs non raggiungibile in lettura: trattiamo come contatore a zero,
    // la scrittura condizionata sotto si occuperà comunque di non
    // sovrascrivere alla cieca se nel frattempo la chiave viene creata.
  }
  return { value: 0, etag: null };
}

async function generateOrderId(items) {
  const { mm, dd, yy } = datePartsRome();
  const dateKey = `${yy}-${mm}-${dd}`;

  // Fallback robusto: usato quando Blobs è irraggiungibile OPPURE quando,
  // dopo 5 tentativi, la scrittura condizionata non è mai riuscita a vincere
  // la corsa (conflitto continuo con altri ordini nello stesso istante). In
  // quel caso NON dobbiamo comunque inventarci un numero: rischierebbe di
  // duplicare il progressivo di un altro ordine dello stesso giorno.
  // Il vecchio fallback Date.now().slice(-3) aveva solo 3 cifre decimali
  // (1000 valori possibili, si ripete più volte al giorno): qui usiamo
  // timestamp in base36 + byte casuali crittografici, entropia molto più alta.
  function robustFallbackProgressive() {
    const t = Date.now().toString(36).toUpperCase().slice(-4);
    const r = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `${t}${r}`;
  }

  let progressive = '000';
  try {
    const store = getOrderCountersStore();

    // Scrittura atomica condizionata (stesso pattern, verificato, di
    // lib/stock.cjs): ogni tentativo rilegge il valore E il suo etag, poi
    // scrive SOLO se nessun altro ha modificato la chiave nel frattempo
    // (onlyIfMatch/onlyIfNew). Se un'altra richiesta concorrente scrive per
    // prima, questa scrittura viene rifiutata esplicitamente dal backend
    // (non è più un "leggi poi scrivi" con verifica a posteriori) e si
    // riprova con il valore fresco. Due ordini nello stesso istante non
    // possono più ricevere lo stesso progressivo.
    let succeeded = false;
    let next = 1;

    for (let attempt = 0; attempt < 5 && !succeeded; attempt++) {
      const { value: current, etag } = await readCounterWithEtag(store, dateKey);
      next = current + 1;
      const writeOptions = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };

      let result;
      try {
        result = await store.setJSON(dateKey, next, writeOptions);
      } catch (err) {
        console.error('Errore di scrittura contatore ordini per', dateKey, err);
        result = null;
      }

      if (result && result.modified !== false) {
        succeeded = true;
        break;
      }

      // Scrittura rifiutata: un altro ordine ha scritto per primo nello
      // stesso istante. Piccola attesa casuale, poi si riprova rileggendo
      // il valore vero invece di ripartire da uno stantio.
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 20 + Math.floor(Math.random() * 60)));
      }
    }

    // Dopo 5 tentativi senza riuscire a vincere la scrittura condizionata,
    // `next` non è affidabile: usiamo il fallback robusto invece di
    // rischiare un progressivo duplicato.
    progressive = succeeded ? String(next).padStart(3, '0') : robustFallbackProgressive();
  } catch (err) {
    // Logghiamo l'errore vero nei log della function Netlify (Netlify UI -> Functions -> logs)
    // così la prossima volta si vede subito perché Blobs non ha scritto nulla,
    // invece di scoprirlo solo dal fatto che lo store risulta vuoto.
    console.error('Netlify Blobs error in generateOrderId:', err);
    progressive = robustFallbackProgressive();
  }

  const suffix = buildSuffix(items) || 'X';

  return `TRPLRG-${mm}${dd}${yy}-${progressive}-${suffix}`;
}

module.exports = { generateOrderId };
