// Registra il risultato finale di una capture PayPal, indicizzato per
// orderID PayPal (non per il nostro TRPLRG orderId). Serve SOLO a rendere
// paypal-capture-order.cjs idempotente: se la stessa richiesta di capture
// arriva due volte (retry di rete lato client, doppio click sul bottone
// prima che la prima risposta torni, o PayPal stesso che risponde
// ORDER_ALREADY_CAPTURED perché una capture precedente è già passata), la
// seconda chiamata restituisce lo STESSO risultato della prima invece di un
// errore generico o di un secondo ordine duplicato.
const { getStore } = require('@netlify/blobs');

function getCaptureRecordStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'paypal-capture-records', siteID, token });
  }
  return getStore('paypal-capture-records');
}

async function saveCaptureResult(paypalOrderID, result) {
  if (!paypalOrderID) return;
  try {
    const store = getCaptureRecordStore();
    await store.setJSON(paypalOrderID, result, { metadata: { savedAt: Date.now() } });
  } catch (err) {
    console.error('Errore nel salvare il record di capture PayPal:', err);
    // Non blocchiamo la risposta al cliente (il pagamento è già incassato):
    // nel peggiore dei casi un eventuale retry non troverà questo record e
    // verrà comunque bloccato più a monte (pendingItems già consumati dalla
    // prima esecuzione riuscita), con un messaggio chiaro invece di un
    // ordine duplicato.
  }
}

async function getCaptureResult(paypalOrderID) {
  if (!paypalOrderID) return null;
  try {
    const store = getCaptureRecordStore();
    return await store.get(paypalOrderID, { type: 'json' });
  } catch {
    return null;
  }
}

module.exports = { saveCaptureResult, getCaptureResult };
