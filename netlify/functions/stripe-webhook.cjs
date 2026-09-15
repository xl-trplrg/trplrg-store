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
const { sendStockAlertEmail, sendShippingMismatchAlert } = require('./lib/stock-alert.cjs');
const { getShippingCost } = require('./lib/shipping.cjs');
const { PRICES } = require('./lib/prices.cjs');

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

        // Decremento scorte E salvataggio ordine sono entrambi IDEMPOTENTI
        // (chiave session.id): se Stripe ripete lo stesso evento, il primo
        // non scala due volte (marker "processed:"), il secondo sovrascrive
        // gli stessi dati senza effetti collaterali. Per questo, se uno dei
        // due fallisce, è SICURO far ritentare Stripe rispondendo 500 —
        // molto meglio che perdere il dato in silenzio con un log che
        // nessuno legge.
        const stockItems = JSON.parse(session.metadata?.stockItems || '[]');
        if (Array.isArray(stockItems) && stockItems.length > 0) {
          const stockResult = await decrementStockOnce(session.id, stockItems);
          if (!stockResult.ok) {
            console.error('Scorte esaurite a metà ordine (Stripe), session:', session.id, 'dettagli:', stockResult);
            await sendStockAlertEmail({
              source: 'stripe-webhook',
              idempotencyKey: session.id,
              handle: stockResult.handle,
              remaining: stockResult.remaining,
              items: stockItems,
            });
          }
        }

        // Confronto tra il paese usato per calcolare la spedizione (scelto
        // sul sito prima del checkout, salvato in metadata) e il paese reale
        // dell'indirizzo raccolto da Stripe nel suo stesso form. Non
        // blocchiamo né correggiamo l'addebito (il pagamento è già
        // concluso): segnaliamo solo se la spedizione corretta per
        // l'indirizzo vero sarebbe costata di più.
        try {
          const pricedCountry = session.metadata?.pricedCountry || null;
          const realCountry = shipping?.address?.country || null;
          const allExemptFromShipping = stockItems.length > 0 && stockItems.every((item) => PRICES[item.handle]?.noShipping);
          if (!allExemptFromShipping && pricedCountry && realCountry && pricedCountry !== realCountry) {
            const chargedCents = parseInt(session.metadata?.pricedShippingCents || '0', 10) || 0;
            const charged = chargedCents / 100;
            const shouldHaveBeen = getShippingCost(realCountry);
            if (shouldHaveBeen !== charged) {
              await sendShippingMismatchAlert({
                source: 'stripe-webhook',
                reference: session.id,
                orderId,
                pricedCountry,
                realCountry,
                charged,
                shouldHaveBeen,
              });
            }
          }
        } catch (err) {
          console.error('Errore nel controllo disallineamento spedizione (Stripe):', err);
          // Solo un alert informativo: non facciamo fallire il webhook per questo.
        }

        await saveStripeConfirmedOrder(session.id, {
          orderId,
          sessionId: session.id,
          items,
          total: (full.amount_total || 0) / 100,
          buyer,
        });
      } catch (err) {
        console.error('Errore nel webhook Stripe (scorte o salvataggio ordine):', err);
        // 500 volontario: Stripe ritenterà questo stesso evento più tardi.
        // Il pagamento resta comunque confermato lato Stripe — qui stiamo
        // solo segnalando "riprova a consegnarmi l'evento", non un problema
        // di pagamento.
        return { statusCode: 500, body: JSON.stringify({ error: 'Elaborazione fallita, riprovare' }) };
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
