// Store SEPARATO da orders-store.cjs (store "order-details", usato da
// get-order-by-id.cjs, l'endpoint pubblico letto dal cliente). Questo qui
// serve solo come log server-side "pagamento Stripe confermato dal webhook",
// per un futuro gestionale/contabilità — non è mai letto da endpoint pubblici.
const { getStore } = require('@netlify/blobs');

function getStripeConfirmedStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'stripe-confirmed-orders', siteID, token });
  }
  return getStore('stripe-confirmed-orders');
}

async function saveStripeConfirmedOrder(key, data) {
  if (!key) return;
  try {
    const store = getStripeConfirmedStore();
    await store.setJSON(key, data, {
      metadata: { confirmedAt: Date.now() },
    });
  } catch (err) {
    console.error('Errore nel salvare la conferma webhook Stripe:', err);
  }
}

module.exports = { saveStripeConfirmedOrder };
