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
  const token = event.queryStringParameters?.token;
  if (!orderId || !token) {
    return { statusCode: 400, body: JSON.stringify({ error: 'order_id o token mancante' }) };
  }

  const data = await getOrderDetails(orderId);

  // Stessa risposta ("Ordine non trovato") sia se l'ordine non esiste sia se il
  // token non corrisponde: così chi prova a indovinare orderId a caso non riesce
  // a distinguere "non esiste" da "esiste ma non è tuo", ed enumerare diventa inutile.
  if (!data || data.accessToken !== token) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Ordine non trovato' }) };
  }

  const { accessToken, ...publicData } = data;
  return { statusCode: 200, body: JSON.stringify(publicData) };
};
