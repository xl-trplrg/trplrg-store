// Salva gli articoli REALI di un ordine PayPal al momento della creazione
// (paypal-create-order.cjs), indicizzati per orderID PayPal. Serve a evitare
// che paypal-capture-order.cjs debba fidarsi degli "items" mandati dal browser
// in quella chiamata separata: userebbe volentieri un carrello diverso da
// quello effettivamente creato e pagato (es. per scalare le scorte del
// prodotto sbagliato). L'orderID stesso non è falsificabile dal client: lo
// genera PayPal, il client si limita a farlo approvare dall'utente.
//
// Non è la fonte di verità del pagamento (quella resta PayPal), è solo il
// carrello (+ paese usato per calcolare la spedizione) che avevamo validato
// un istante prima di mandarlo a PayPal. Il paese serve a
// paypal-capture-order.cjs per confrontarlo con l'indirizzo di spedizione
// reale restituito da PayPal alla capture (vedi commento lì).
const { getStore } = require('@netlify/blobs');

function getPendingStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'paypal-pending-items', siteID, token });
  }
  return getStore('paypal-pending-items');
}

async function savePendingItems(orderID, items, country) {
  if (!orderID) return;
  try {
    const store = getPendingStore();
    await store.setJSON(orderID, { items, country: country || null }, {
      metadata: { savedAt: Date.now() },
    });
  } catch (err) {
    console.error('Errore nel salvare gli articoli pending PayPal:', err);
    // Se il salvataggio fallisce, paypal-capture-order.cjs userà il fallback
    // (items mandati dal client) — non blocchiamo la creazione dell'ordine.
  }
}

// Ritorna sempre { items, country }, indipendentemente da quale forma sia
// salvata su Blobs: retrocompatibile con eventuali entry salvate dalla
// versione precedente di questo file (un semplice array di items, senza
// country), che possono restare valide per pochi minuti a cavallo di un
// deploy — normale finestra di approvazione PayPal, non un caso permanente.
async function getPendingItems(orderID) {
  if (!orderID) return null;
  try {
    const store = getPendingStore();
    const data = await store.get(orderID, { type: 'json' });
    if (!data) return null;
    if (Array.isArray(data)) return { items: data, country: null }; // forma precedente
    return { items: data.items || null, country: data.country || null };
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
