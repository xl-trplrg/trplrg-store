// Recupera i dettagli di un ordine PayPal/Google Pay salvati da
// generate-order-id.cjs o google-pay-charge.cjs, usato dalla pagina di
// conferma quando l'utente fa refresh (perde lo stato React) e non c'è un
// session_id Stripe da usare al suo posto.
const { getOrderDetails } = require('./lib/orders-store.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const orderId = event.queryStringParameters?.order_id;
  if (!orderId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'order_id mancante' }) };
  }

  const data = await getOrderDetails(orderId);
  if (!data) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Ordine non trovato' }) };
  }

  return { statusCode: 200, body: JSON.stringify(data) };
};
