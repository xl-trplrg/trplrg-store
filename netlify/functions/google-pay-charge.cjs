// Funzione serverless (Netlify Function) che incassa un pagamento Google Pay tramite Stripe.
// Riceve il "token" generato da Google Pay (già passato attraverso Stripe come gateway) e lo
// usa per addebitare la carta scelta dal cliente.
//
// COME CONFIGURARLA: usa la stessa STRIPE_SECRET_KEY già impostata su Netlify per
// create-checkout-session.cjs — nessuna configurazione aggiuntiva richiesta qui.

const Stripe = require('stripe');

// Stessa fonte di verità prezzi usata da create-checkout-session.cjs.
// Se aggiorni un prezzo in un posto, aggiornalo anche nell'altro.
const PRICES = {
  'xl-vinile': { name: 'TROPPO LARGO Vinyl', price: 30 },
  'xl-cd': { name: 'TROPPO LARGO CD Edition', price: 20 },
  'xl-maglietta': { name: 'YATP T-Shirt Bianca', price: 25 },
  'xl-felpa': { name: 'TROPPO LARGO - Hoodie', price: 40 },
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { tokenId, items } = JSON.parse(event.body);

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
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Pagamento non completato', status: paymentIntent.status }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
