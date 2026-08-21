// Funzione serverless chiamata dal browser SOLO dopo che un pagamento PayPal o Google Pay
// è già andato a buon fine (il pagamento vero avviene altrove: PayPal SDK o google-pay-charge.cjs).
// Questa funzione si occupa solo di generare un Order ID progressivo, mai di soldi.

const { generateOrderId } = require('./lib/order-id.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { items } = JSON.parse(event.body);
    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Carrello vuoto' }) };
    }
    const orderId = await generateOrderId(items);
    return { statusCode: 200, body: JSON.stringify({ orderId }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
