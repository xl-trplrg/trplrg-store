// Funzione serverless (Netlify Function) che crea una sessione di pagamento Stripe.
// Gira sul server di Netlify, mai nel browser: qui dentro è sicuro usare la chiave segreta Stripe.
//
// COME CONFIGURARLA:
// 1. Su Netlify: Site settings -> Environment variables -> aggiungi STRIPE_SECRET_KEY (la tua chiave sk_live_... o sk_test_...)
// 2. Non serve incollarla da nessun'altra parte, nè nel codice nè in chat.

const Stripe = require('stripe');
const { generateOrderId } = require('./lib/order-id.cjs');
const { getShippingCost } = require('./lib/shipping.cjs');

// IMPORTANTE: questa lista prezzi è la fonte di verità server-side.
// Deve restare identica a src/data/products.ts (handle + price), altrimenti i totali non torneranno.
// Quando aggiorni un prezzo in products.ts, aggiornalo anche qui.
const PRICES = {
  'xl-vinile': { name: 'TROPPO LARGO Vinyl', price: 30, img: '/products/vinile.jpg' },
  'xl-cd': { name: 'TROPPO LARGO CD Edition', price: 20, img: '/products/cd.jpg' },
  'xl-maglietta': { name: 'YATP T-Shirt Bianca', price: 25, img: '/products/tshirt-front.jpg' },
  'xl-felpa': { name: 'TROPPO LARGO - Hoodie', price: 40, img: '/products/hoodie-front.jpg' },
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { items, country } = JSON.parse(event.body);

    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Carrello vuoto' }) };
    }

    const origin = event.headers.origin || `https://${event.headers.host}`;

    // Costruzione line_items usando SOLO i prezzi noti dal server (mai quelli mandati dal client)
    const line_items = items.map((item) => {
      const known = PRICES[item.handle];
      if (!known) throw new Error(`Prodotto sconosciuto: ${item.handle}`);
      const name = item.size ? `${known.name} — Taglia ${item.size}` : known.name;
      return {
        price_data: {
          currency: 'eur',
          product_data: { name, images: [`${origin}${known.img}`] },
          unit_amount: Math.round(known.price * 100),
        },
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
      };
    });

    // Costo di spedizione in base al paese scelto sul carrello (zone BRT, vedi lib/shipping.cjs)
    const shippingCost = Math.round(getShippingCost(country) * 100);
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

    let orderId = 'TRPLRG-000000-000-X';
    try {
      orderId = await generateOrderId(items);
    } catch {
      // non blocchiamo mai un pagamento per un problema di generazione ID
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      metadata: { orderId },
      shipping_address_collection: {
        allowed_countries: [
          'IT', 'FR', 'DE', 'AT', 'NL', 'HR', 'HU', 'SI',
          'ES', 'BE', 'PL', 'BG', 'CZ', 'LU',
          'DK', 'PT', 'GR', 'SK', 'RO',
          'SE', 'FI', 'EE', 'LV', 'LT', 'IE', 'GB', 'CH',
          'US', 'CA',
        ],
      },
      success_url: `${origin}/ordine-confermato?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart?checkout=cancel`,
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
