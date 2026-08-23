// Funzione serverless chiamata dal browser SOLO dopo che un pagamento PayPal o Google Pay
// è già andato a buon fine (il pagamento vero avviene altrove: PayPal SDK o google-pay-charge.cjs).
// Questa funzione si occupa solo di generare un Order ID progressivo, mai di soldi.

const { generateOrderId } = require('./lib/order-id.cjs');
const { saveOrderDetails } = require('./lib/orders-store.cjs');
const { PRICES } = require('./lib/prices.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { items, buyer, total: clientTotal } = JSON.parse(event.body);
    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Carrello vuoto' }) };
    }
    const orderId = await generateOrderId(items);

    // Salviamo una copia dei dettagli ordine così la pagina di conferma
    // sopravvive a un refresh anche per gli ordini PayPal, che non hanno un
    // session_id come Stripe. NOTA: qui il totale può includere la spedizione
    // (passata dal client), ma questo salvataggio serve SOLO per la visualizzazione
    // — l'addebito reale è già stato validato e incassato da PayPal stesso prima
    // che questa funzione venga chiamata, quindi fidarsi del client qui non è
    // un rischio di sicurezza sui soldi.
    const orderItems = items.map((item) => {
      const known = PRICES[item.handle];
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      return {
        name: item.size ? `${known?.name || item.handle} — Taglia ${item.size}` : (known?.name || item.handle),
        quantity: qty,
        amount: (known?.price || 0) * qty,
        image: known?.img || null,
        downloadUrl: known?.downloadUrl || null,
      };
    });
    const itemsSum = orderItems.reduce((sum, i) => sum + i.amount, 0);
    const total = typeof clientTotal === 'number' && clientTotal >= itemsSum ? clientTotal : itemsSum;
    await saveOrderDetails(orderId, { orderId, items: orderItems, total, buyer: buyer || null });

    return { statusCode: 200, body: JSON.stringify({ orderId }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
