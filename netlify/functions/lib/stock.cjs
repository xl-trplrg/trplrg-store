// Scorte per prodotto, salvate su Netlify Blobs con lo stesso meccanismo già
// usato per il numero d'ordine progressivo (vedi lib/order-id.cjs): non è un
// lock atomico vero (richiederebbe un database con transazioni), ma con un
// controllo prima del pagamento + un decremento con verifica dopo, il rischio
// di vendere due volte l'ultimo pezzo resta molto basso per un negozio di
// queste dimensioni.
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

const { getStore } = require('@netlify/blobs');

function getStockStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'stock', siteID, token });
  }
  return getStore('stock');
}

async function readCurrent(store, handle) {
  try {
    const existing = await store.get(handle, { type: 'json' });
    if (typeof existing === 'number') return existing;
  } catch {
    // Blobs non raggiungibile: trattiamo come "scorta iniziale" per non
    // bloccare un acquisto per un problema di lettura.
  }
  return INITIAL_STOCK[handle];
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

    for (let attempt = 0; attempt < 3 && !succeeded; attempt++) {
      const current = await readCurrent(store, handle);
      lastKnown = current;

      if (current < qty) break; // esaurito in questo istante: usciamo, gestito sotto

      const next = current - qty;
      await store.setJSON(handle, next);

      try {
        const verify = await store.get(handle, { type: 'json' });
        if (verify === next) {
          succeeded = true;
          break;
        }
      } catch {
        succeeded = true; // scrittura andata a buon fine, verifica non disponibile
        break;
      }

      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 30 + Math.floor(Math.random() * 50)));
      }
    }

    if (succeeded) {
      applied.push({ handle, qty });
    } else {
      // Esaurito a metà ordine: ripristiniamo quanto già scalato per gli altri
      // articoli dello STESSO ordine. O va scalato tutto, o niente.
      for (const done of applied) {
        try {
          const current = await readCurrent(store, done.handle);
          await store.setJSON(done.handle, current + done.qty);
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
      await store.setJSON(markerKey, true);
    } catch (err) {
      console.error('Errore nel salvare il marker idempotenza scorte:', err);
    }
  }

  return result;
}

module.exports = { hasEnoughStock, decrementStockOnce };
