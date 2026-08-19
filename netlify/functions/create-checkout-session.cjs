// Funzione serverless (Netlify Function) che crea una sessione di pagamento Stripe.
// Gira sul server di Netlify, mai nel browser: qui dentro è sicuro usare la chiave segreta Stripe.
//
// COME CONFIGURARLA:
// 1. Su Netlify: Site settings -> Environment variables -> aggiungi STRIPE_SECRET_KEY (la tua chiave sk_live_... o sk_test_...)
// 2. Non serve incollarla da nessun'altra parte, nè nel codice nè in chat.

const Stripe = require('stripe');

// IMPORTANTE: questa lista prezzi è la fonte di verità server-side.
// Deve restare identica a src/data/products.ts (handle + price), altrimenti i totali non torneranno.
// Quando aggiorni un prezzo in products.ts, aggiornalo anche qui.
const PRICES = {
  'xl-vinile': { name: 'TROPPO LARGO Vinyl', price: 30 },
  'xl-cd': { name: 'TROPPO LARGO CD Edition', price: 20 },
  'xl-maglietta': { name: 'YATP T-Shirt Bianca', price: 25 },
  'xl-felpa': { name: 'TROPPO LARGO - Hoodie', price: 40 },
};

// Tariffe di spedizione fisse per zona (come deciso: Italia inclusa, poi fasce).
const SHIPPING = {
  IT: 0,
  EU: 1200, // 12€ in centesimi
  WORLD: 2000, // 20€ in centesimi
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { items, shippingZone } = JSON.parse(event.body);

    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Carrello vuoto' }) };
    }

    // Costruzione line_items usando SOLO i prezzi noti dal server (mai quelli mandati dal client)
    const line_items = items.map((item) => {
      const known = PRICES[item.handle];
      if (!known) throw new Error(`Prodotto sconosciuto: ${item.handle}`);
      const name = item.size ? `${known.name} — Taglia ${item.size}` : known.name;
      return {
        price_data: {
          currency: 'eur',
          product_data: { name },
          unit_amount: Math.round(known.price * 100),
        },
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
      };
    });

    const shippingCost = SHIPPING[shippingZone] ?? SHIPPING.WORLD;
    if (shippingCost > 0) {
      line_items.push({
        price_data: {
          currency: 'eur',
          product_data: { name: 'Spedizione' },
          unit_amount: shippingCost,
        },
        quantity: 1,
      });
    }

    const origin = event.headers.origin || `https://${event.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      shipping_address_collection: { allowed_countries: ['IT', 'FR', 'DE', 'ES', 'GB', 'US', 'PT', 'NL', 'BE', 'AT', 'CH'] },
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/cart?checkout=cancel`,
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
