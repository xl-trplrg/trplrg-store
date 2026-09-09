// Netlify Function chiamata direttamente da Stripe (non dal browser) quando
// succede qualcosa sul pagamento. Qui gestiamo solo checkout.session.completed:
// serve come log server-side affidabile "questo pagamento è confermato da
// Stripe", indipendente dal fatto che il browser del cliente arrivi o meno
// alla pagina di conferma. NON sostituisce e non modifica in alcun modo il
// flusso esistente: create-checkout-session.cjs continua a generare l'orderId
// come prima, get-order-details.cjs continua a leggere da Stripe come prima.
//
// COME CONFIGURARLA (da fare voi, non è automatico):
// 1. Stripe Dashboard -> Developers -> Webhooks -> Add endpoint
//    URL: https://trplrg.com/.netlify/functions/stripe-webhook
//    Evento da ascoltare: checkout.session.completed
// 2. Stripe vi mostra un "Signing secret" (whsec_...): copiatelo
// 3. Netlify -> Site settings -> Environment variables -> aggiungete
//    STRIPE_WEBHOOK_SECRET con quel valore (usa la stessa STRIPE_SECRET_KEY
//    già presente per il resto, nessun'altra chiave nuova richiesta)

const Stripe = require('stripe');
const { saveStripeConfirmedOrder } = require('./lib/stripe-confirmed-store.cjs');
const { decrementStockOnce } = require('./lib/stock.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = event.headers['stripe-signature'];
  if (!webhookSecret || !signature) {
    return { statusCode: 400, body: 'Configurazione webhook mancante' };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  // Stripe richiede il body ESATTO ricevuto (non ri-serializzato) per
  // verificare la firma: se Netlify lo consegna in base64 va decodificato
  // prima, senza passare per JSON.parse/stringify.
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Firma webhook Stripe non valida:', err.message);
    return { statusCode: 400, body: `Firma non valida: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    if (session.payment_status === 'paid') {
      try {
        const full = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items.data.price.product'],
        });

        const items = (full.line_items?.data || []).map((li) => ({
          name: li.description,
          quantity: li.quantity,
          amount: (li.amount_total || 0) / 100,
          image: li.price?.product?.images?.[0] || null,
        }));

        let buyer = null;
        const shipping = full.shipping_details;
        if (shipping?.name && shipping?.address) {
          const a = shipping.address;
          const addressLine = [a.line1, a.line2].filter(Boolean).join(', ');
          buyer = {
            name: shipping.name,
            address: `${addressLine}, ${a.postal_code || ''} ${a.city || ''}${a.state ? ' (' + a.state + ')' : ''} - ${a.country || ''}`,
          };
        }

        const orderId = session.metadata?.orderId || null;

        // Decremento scorte SOLO qui: è l'unico punto server-side che conferma
        // in modo affidabile "questo pagamento è andato a buon fine", con
        // protezione da doppio decremento se Stripe ripete lo stesso evento
        // (usa session.id come chiave, quindi anche in caso di retry decrementa una volta sola).
        try {
          const stockItems = JSON.parse(session.metadata?.stockItems || '[]');
          if (Array.isArray(stockItems) && stockItems.length > 0) {
            await decrementStockOnce(session.id, stockItems);
          }
        } catch (err) {
          console.error('Errore nel decremento scorte dal webhook Stripe:', err);
          // Non blocchiamo mai la risposta a Stripe per un problema di scorte:
          // il pagamento è già confermato, va gestito manualmente se serve.
        }

        await saveStripeConfirmedOrder(session.id, {
          orderId,
          sessionId: session.id,
          items,
          total: (full.amount_total || 0) / 100,
          buyer,
        });
      } catch (err) {
        console.error('Errore nel recuperare/salvare i dettagli ordine dal webhook:', err);
        // Non falliamo mai la risposta a Stripe per un problema di salvataggio:
        // altrimenti Stripe ritenta lo stesso evento più volte inutilmente.
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
