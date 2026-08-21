// Funzione serverless che recupera i dettagli di un ordine Stripe già pagato,
// usata dalla pagina di conferma quando l'utente torna dal checkout Stripe (redirect esterno,
// quindi lo stato del carrello React è perso: recuperiamo tutto da Stripe stesso).

const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'session_id mancante' }) };
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price.product'],
    });

    if (session.payment_status !== 'paid') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Ordine non pagato' }) };
    }

    const items = session.line_items.data.map((li) => ({
      name: li.description,
      quantity: li.quantity,
      amount: (li.amount_total || 0) / 100,
      image: li.price?.product?.images?.[0] || null,
    }));

    let buyer = null;
    const shipping = session.shipping_details;
    if (shipping?.name && shipping?.address) {
      const a = shipping.address;
      const addressLine = [a.line1, a.line2].filter(Boolean).join(', ');
      buyer = {
        name: shipping.name,
        address: `${addressLine}, ${a.postal_code || ''} ${a.city || ''}${a.state ? ' (' + a.state + ')' : ''} - ${a.country || ''}`,
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        orderId: session.metadata?.orderId || null,
        items,
        total: (session.amount_total || 0) / 100,
        buyer,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
