// Funzione serverless (Netlify Function) che crea un ordine PayPal.
// Prima il totale veniva calcolato nel browser (PayPalButton.tsx -> actions.order.create),
// il che permetteva di alterarlo con gli strumenti sviluppatore prima dell'invio a PayPal.
// Ora il totale è calcolato QUI, sullo stesso principio già usato da
// create-checkout-session.cjs (Stripe) e google-pay-charge.cjs (Google Pay):
// mai fidarsi di un importo mandato dal client, solo del catalogo server-side.

const { getPayPalAccessToken } = require('./lib/paypal-client.cjs');
const { getShippingCost } = require('./lib/shipping.cjs');

// Stessa fonte di verità prezzi usata da Stripe e Google Pay.
const { PRICES } = require('./lib/prices.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { items, country } = JSON.parse(event.body);

    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Carrello vuoto' }) };
    }

    // Totale articoli calcolato SOLO dal catalogo server-side (mai da quello che manda il browser).
    const paypalItems = items.map((item) => {
      const known = PRICES[item.handle];
      if (!known) throw new Error(`Prodotto sconosciuto: ${item.handle}`);
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const name = item.size ? `${known.name} — Taglia ${item.size}` : known.name;
      return {
        name,
        unit_amount: { currency_code: 'EUR', value: known.price.toFixed(2) },
        quantity: String(qty),
        _lineTotal: known.price * qty,
      };
    });
    const itemTotal = paypalItems.reduce((sum, i) => sum + i._lineTotal, 0);

    // Stessa logica di esenzione/override spedizione già usata da Stripe e Google Pay.
    // Se non arriva un country (es. acquisto diretto dalla pagina prodotto, che oggi
    // non gestisce la spedizione), la spedizione resta 0 — comportamento invariato.
    const allExemptFromShipping = items.every((item) => PRICES[item.handle]?.noShipping);
    const testOverride = items.every((item) => typeof PRICES[item.handle]?.testShippingOverride === 'number')
      ? PRICES[items[0].handle].testShippingOverride
      : undefined;
    const shippingCost = (!country || allExemptFromShipping)
      ? 0
      : (testOverride ?? getShippingCost(country));

    const total = itemTotal + shippingCost;

    const accessToken = await getPayPalAccessToken();

    const purchaseUnit = {
      amount: {
        currency_code: 'EUR',
        value: total.toFixed(2),
        breakdown: {
          // PayPal richiede che item_total sia ESATTAMENTE la somma degli unit_amount
          // degli items sotto — la spedizione va nel suo campo separato (stesso vincolo
          // già gestito lato client nella versione precedente di PayPalButton.tsx).
          item_total: { currency_code: 'EUR', value: itemTotal.toFixed(2) },
          shipping: { currency_code: 'EUR', value: shippingCost.toFixed(2) },
        },
      },
      items: paypalItems.map(({ _lineTotal, ...rest }) => rest),
    };

    const response = await fetch('https://api.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [purchaseUnit],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Errore creazione ordine PayPal:', errText);
      throw new Error(`Errore PayPal: ${response.status}`);
    }

    const data = await response.json();

    return { statusCode: 200, body: JSON.stringify({ orderID: data.id }) };
  } catch (err) {
    console.error('Errore in paypal-create-order:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
