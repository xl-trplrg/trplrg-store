// Funzione serverless (Netlify Function) che incassa un pagamento Google Pay tramite Stripe.
// Riceve il "token" generato da Google Pay (già passato attraverso Stripe come gateway) e lo
// usa per addebitare la carta scelta dal cliente.
//
// COME CONFIGURARLA: usa la stessa STRIPE_SECRET_KEY già impostata su Netlify per
// create-checkout-session.cjs — nessuna configurazione aggiuntiva richiesta qui.

const Stripe = require('stripe');
const { generateOrderId } = require('./lib/order-id.cjs');
const { getShippingCost } = require('./lib/shipping.cjs');

// Stessa fonte di verità prezzi usata da create-checkout-session.cjs.
// Se aggiorni un prezzo in un posto, aggiornalo anche nell'altro.
const PRICES = {
  'xl-vinile': { name: 'TROPPO LARGO Vinyl', price: 30 },
  'xl-cd': { name: 'TROPPO LARGO CD Edition', price: 20 },
  'xl-maglietta': { name: 'YATP T-Shirt Bianca', price: 25 },
  'xl-felpa': { name: 'TROPPO LARGO - Hoodie', price: 40 },
  // TEST — rimuovere insieme alla voce in src/data/products.ts a test completato.
  'xl-test-checkout': { name: 'TEST — Prodotto di verifica checkout', price: 1, noShipping: true },
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { tokenId, items, country } = JSON.parse(event.body);

    if (!tokenId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Token mancante' }) };
    }
    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Carrello vuoto' }) };
    }

    // Totale calcolato SOLO dal server, mai da quello che manda il browser.
    let amount = 0;
    for (const item of items) {
      const known = PRICES[item.handle];
      if (!known) throw new Error(`Prodotto sconosciuto: ${item.handle}`);
      amount += known.price * Math.max(1, parseInt(item.quantity, 10) || 1);
    }
    const allExemptFromShipping = items.every((item) => PRICES[item.handle]?.noShipping);
    if (!allExemptFromShipping) {
      amount += getShippingCost(country);
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'eur',
      payment_method_data: {
        type: 'card',
        card: { token: tokenId },
      },
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    });

    if (paymentIntent.status === 'succeeded') {
      let orderId = 'TRPLRG-000000-000-X';
      try {
        orderId = await generateOrderId(items);
      } catch {
        // il pagamento è già riuscito, non blocchiamo la risposta per un problema di order-id
      }
      return { statusCode: 200, body: JSON.stringify({ success: true, orderId }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Pagamento non completato', status: paymentIntent.status }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
