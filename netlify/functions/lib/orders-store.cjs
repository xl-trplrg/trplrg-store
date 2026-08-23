// Salva i dettagli di un ordine PayPal/Google Pay su Netlify Blobs, indicizzati
// per orderId. Serve solo per far funzionare il refresh della pagina di
// conferma ordine — per Stripe non serve, perché quella pagina recupera tutto
// direttamente da Stripe stesso (fonte di verità già affidabile).
// Qui NON è la fonte di verità del pagamento (quella resta PayPal/Stripe),
// è solo una copia "di comodo" per poter mostrare il riepilogo anche dopo un
// refresh della pagina.
const { getStore } = require('@netlify/blobs');

function getOrdersStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'order-details', siteID, token });
  }
  return getStore('order-details');
}

async function saveOrderDetails(orderId, data) {
  if (!orderId) return;
  try {
    const store = getOrdersStore();
    await store.setJSON(orderId, data, {
      // Non ci serve tenerli per sempre: 30 giorni bastano ampiamente per
      // qualsiasi refresh o supporto post-vendita.
      metadata: { savedAt: Date.now() },
    });
  } catch {
    // Se il salvataggio fallisce non blocchiamo l'ordine (che è già stato
    // pagato): il cliente vede comunque la conferma nella stessa sessione,
    // semplicemente non sopravvive a un refresh.
  }
}

async function getOrderDetails(orderId) {
  if (!orderId) return null;
  try {
    const store = getOrdersStore();
    return await store.get(orderId, { type: 'json' });
  } catch {
    return null;
  }
}

module.exports = { saveOrderDetails, getOrderDetails };
