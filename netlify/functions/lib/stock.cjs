// Scorte per prodotto, salvate su Netlify Blobs. Le scritture sono ATOMICHE:
// ogni decremento usa una scrittura condizionata all'etag letto un attimo
// prima (onlyIfMatch/onlyIfNew, supportate nativamente da Netlify Blobs). Se
// un'altra richiesta concorrente ha già scritto nel frattempo, la scrittura
// viene rifiutata esplicitamente (non sovrascritta alla cieca) e si ritenta
// con il valore fresco — due acquisti simultanei dell'ultimo pezzo non
// possono più passare entrambi.
//
// SCORTE INIZIALI — aggiorna qui se cambiano le quantità fisiche disponibili.
// Le taglie di maglietta/felpa NON sono tracciate separatamente: è un totale
// unico per prodotto, come richiesto.
const INITIAL_STOCK = {
  'xl-vinile': 500,
  'xl-cd': 500,
  'xl-maglietta': 200,
  'xl-felpa': 200,
};

// Limite di buonsenso per riga d'ordine (somma tutte le taglie dello stesso
// prodotto): evita carrelli assurdi (es. 99 pezzi) indipendentemente dalle
// scorte reali. Cambialo qui se serve un numero diverso.
const MAX_PER_PRODUCT = 10;

// I marker `processed:` si accumulerebbero per sempre nel Blobs store. Ogni
// tanto (al più una volta all'ora, e solo a ridosso di una scrittura riuscita)
// eliminiamo quelli più vecchi di 30 giorni: un pagamento di un mese fa non
// può più arrivare in ritardo. I marker salvati prima di questo cambiamento
// (senza data in metadata) restano semplicemente intoccabili.
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const MARKER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
let lastMarkerPrune = 0;

async function pruneProcessedMarkers(store) {
  const now = Date.now();
  if (now - lastMarkerPrune < PRUNE_INTERVAL_MS) return;
  lastMarkerPrune = now;
  try {
    const { blobs } = await store.list({ prefix: 'processed:' });
    let deleted = 0;
    for (const blob of blobs || []) {
      const doneAt = blob?.metadata?.doneAt;
      if (typeof doneAt === 'number' && now - doneAt > MARKER_TTL_MS) {
        await store.delete(blob.key);
        if (++deleted >= 50) break; // pulizia graduale, mai bloccante a lungo
      }
    }
  } catch (err) {
    console.error('Errore nella pulizia marker scorte:', err);
  }
}

const { getStore } = require('@netlify/blobs');

function getStockStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'stock', siteID, token });
  }
  return getStore('stock');
}

async function readCurrentWithEtag(store, handle) {
  try {
    const entry = await store.getWithMetadata(handle, { type: 'json' });
    if (entry && typeof entry.data === 'number') {
      return { value: entry.data, etag: entry.etag };
    }
  } catch {
    // Blobs non raggiungibile: trattiamo come "scorta iniziale" per non
    // bloccare un acquisto per un problema di lettura.
  }
  // Chiave mai creata: valore di partenza è INITIAL_STOCK, nessun etag
  // (la prima scrittura per questo handle userà onlyIfNew, non onlyIfMatch).
  return { value: INITIAL_STOCK[handle], etag: null };
}

async function readCurrent(store, handle) {
  const { value } = await readCurrentWithEtag(store, handle);
  return value;
}

// Somma le quantità richieste per handle. Un carrello con più taglie della
// stessa felpa conta come un'unica quantità sul totale felpa (scorte non
// per taglia, per scelta). I prodotti non presenti in INITIAL_STOCK (es. un
// futuro articolo digitale) non vengono tracciati e non bloccano mai nulla.
function sumQuantitiesByHandle(items) {
  const totals = {};
  for (const item of items) {
    if (!(item.handle in INITIAL_STOCK)) continue;
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    totals[item.handle] = (totals[item.handle] || 0) + qty;
  }
  return totals;
}

// Controllo NON vincolante, da fare PRIMA di avviare un pagamento (creazione
// sessione Stripe / ordine PayPal / addebito Google Pay), per bloccare subito
// un acquisto palesemente impossibile. Non decrementa nulla: il controllo
// vero e vincolante è decrementStockOnce, eseguito dopo il pagamento confermato.
async function hasEnoughStock(items) {
  const store = getStockStore();
  const totals = sumQuantitiesByHandle(items);
  for (const [handle, qty] of Object.entries(totals)) {
    const current = await readCurrent(store, handle);
    if (current < qty) return { ok: false, handle };
  }
  return { ok: true };
}

async function decrementStock(items) {
  const store = getStockStore();
  const totals = sumQuantitiesByHandle(items);
  const handles = Object.keys(totals);
  if (handles.length === 0) return { ok: true, applied: [] };

  const applied = [];

  for (const handle of handles) {
    const qty = totals[handle];
    let succeeded = false;
    let lastKnown = INITIAL_STOCK[handle];

    // Scrittura atomica condizionata: ogni tentativo rilegge il valore E il
    // suo etag, poi scrive SOLO se nessun altro ha modificato la chiave nel
    // frattempo (onlyIfMatch/onlyIfNew). Se un'altra richiesta concorrente ha
    // scritto per prima, questa scrittura fallisce esplicitamente (non
    // sovrascrive alla cieca) e si ritenta con il valore fresco — a
    // differenza di un semplice "leggi poi scrivi", qui due acquisti
    // simultanei dell'ultimo pezzo non possono più passare entrambi.
    for (let attempt = 0; attempt < 5 && !succeeded; attempt++) {
      const { value: current, etag } = await readCurrentWithEtag(store, handle);
      lastKnown = current;

      if (current < qty) break; // esaurito in questo istante: usciamo, gestito sotto

      const next = current - qty;
      const writeOptions = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };

      let result;
      try {
        result = await store.setJSON(handle, next, writeOptions);
      } catch (err) {
        console.error('Errore di scrittura scorte per', handle, err);
        result = null;
      }

      if (result && result.modified !== false) {
        succeeded = true;
        break;
      }

      // Scrittura rifiutata: un'altra richiesta ha modificato la chiave nel
      // frattempo (o l'ha creata per prima). Piccola attesa casuale, poi si
      // rilegge il valore vero al prossimo giro invece di ripartire da uno stantio.
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 20 + Math.floor(Math.random() * 60)));
      }
    }

    if (succeeded) {
      applied.push({ handle, qty });
    } else {
      // Esaurito a metà ordine, o troppi tentativi in conflitto: ripristiniamo
      // quanto già scalato per gli altri articoli dello STESSO ordine.
      // O va scalato tutto, o niente.
      for (const done of applied) {
        try {
          // Anche il ripristino usa una scrittura condizionata, per lo stesso motivo.
          for (let r = 0; r < 5; r++) {
            const { value: cur, etag: curEtag } = await readCurrentWithEtag(store, done.handle);
            const restored = cur + done.qty;
            const opts = curEtag ? { onlyIfMatch: curEtag } : { onlyIfNew: true };
            const res = await store.setJSON(done.handle, restored, opts);
            if (res && res.modified !== false) break;
          }
        } catch (err) {
          console.error('Errore nel ripristino scorte dopo esaurimento parziale:', err);
        }
      }
      return { ok: false, handle, remaining: lastKnown };
    }
  }

  return { ok: true, applied };
}

// Decremento con protezione da doppie chiamate per lo stesso pagamento
// (es. Stripe che ripete la stessa webhook, o una capture PayPal ritentata).
// idempotencyKey è l'identificativo univoco del pagamento (session.id Stripe,
// paymentIntent.id Google Pay, orderID PayPal) — se già processato, non
// scaliamo le scorte una seconda volta.
async function decrementStockOnce(idempotencyKey, items) {
  const store = getStockStore();
  const markerKey = idempotencyKey ? `processed:${idempotencyKey}` : null;

  if (markerKey) {
    try {
      const already = await store.get(markerKey, { type: 'json' });
      if (already) return { ok: true, alreadyProcessed: true };
    } catch {
      // se la lettura del marker fallisce, procediamo comunque: meglio un
      // decremento in più (raro) che bloccare un ordine già pagato
    }
  }

  const result = await decrementStock(items);

  if (result.ok && markerKey) {
    try {
      await store.setJSON(markerKey, true, { metadata: { doneAt: Date.now() } });
      await pruneProcessedMarkers(store);
    } catch (err) {
      console.error('Errore nel salvare il marker idempotenza scorte:', err);
    }
  }

  return result;
}

// Controllo indipendente dalle scorte: blocca quantità assurde per riga
// prodotto prima ancora di guardare il magazzino. Va chiamato insieme a
// hasEnoughStock, prima di avviare un pagamento.
function exceedsMaxPerProduct(items) {
  const totals = sumQuantitiesByHandle(items);
  for (const [handle, qty] of Object.entries(totals)) {
    if (qty > MAX_PER_PRODUCT) return { ok: false, handle, max: MAX_PER_PRODUCT };
  }
  return { ok: true };
}

module.exports = { hasEnoughStock, decrementStockOnce, exceedsMaxPerProduct, MAX_PER_PRODUCT };
