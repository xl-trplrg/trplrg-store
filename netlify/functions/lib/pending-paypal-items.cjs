// Salva gli articoli REALI di un ordine PayPal al momento della creazione
// (paypal-create-order.cjs), indicizzati per orderID PayPal. Serve a evitare
// che paypal-capture-order.cjs debba fidarsi degli "items" mandati dal browser
// in quella chiamata separata: userebbe volentieri un carrello diverso da
// quello effettivamente creato e pagato (es. per scalare le scorte del
// prodotto sbagliato). L'orderID stesso non è falsificabile dal client: lo
// genera PayPal, il client si limita a farlo approvare dall'utente.
//
// Non è la fonte di verità del pagamento (quella resta PayPal), è solo il
// carrello che avevamo validato un istante prima di mandarlo a PayPal.
const { getStore } = require('@netlify/blobs');

function getPendingStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'paypal-pending-items', siteID, token });
  }
  return getStore('paypal-pending-items');
}

async function savePendingItems(orderID, items) {
  if (!orderID) return;
  try {
    const store = getPendingStore();
    await store.setJSON(orderID, items, {
      metadata: { savedAt: Date.now() },
    });
  } catch (err) {
    console.error('Errore nel salvare gli articoli pending PayPal:', err);
    // Se il salvataggio fallisce, paypal-capture-order.cjs userà il fallback
    // (items mandati dal client) — non blocchiamo la creazione dell'ordine.
  }
}

async function getPendingItems(orderID) {
  if (!orderID) return null;
  try {
    const store = getPendingStore();
    return await store.get(orderID, { type: 'json' });
  } catch {
    return null;
  }
}

async function deletePendingItems(orderID) {
  if (!orderID) return;
  try {
    const store = getPendingStore();
    await store.delete(orderID);
  } catch {
    // pulizia best-effort, non critica
  }
}

module.exports = { savePendingItems, getPendingItems, deletePendingItems };
