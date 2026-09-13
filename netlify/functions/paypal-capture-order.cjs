// Funzione serverless (Netlify Function) che incassa (capture) un ordine PayPal
// creato da paypal-create-order.cjs. Prima la capture avveniva nel browser
// (actions.order.capture()); ora la fa il server, che è l'unico a poter
// autorizzare l'incasso — il browser si limita a dire "l'utente ha approvato".
//
// Dopo l'incasso, genera l'Order ID interno TRPLRG (stesso formato di
// Stripe/Google Pay) e salva una copia dei dettagli per la pagina di conferma,
// esattamente come fa già generate-order-id.cjs per il vecchio flusso.

const crypto = require('crypto');
const { getPayPalAccessToken } = require('./lib/paypal-client.cjs');
const { generateOrderId } = require('./lib/order-id.cjs');
const { saveOrderDetails } = require('./lib/orders-store.cjs');
const { PRICES } = require('./lib/prices.cjs');
const { decrementStockOnce } = require('./lib/stock.cjs');
const { sendStockAlertEmail } = require('./lib/stock-alert.cjs');
const { getPendingItems, deletePendingItems } = require('./lib/pending-paypal-items.cjs');

// URL base dell'API PayPal, configurabile via env var per poter puntare alla
// sandbox in test (PAYPAL_API_BASE_URL=https://api-m.sandbox.paypal.com) senza
// toccare il codice. Se non impostata, si resta sulla produzione come prima.
const PAYPAL_API_BASE_URL = process.env.PAYPAL_API_BASE_URL || 'https://api.paypal.com';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { orderID, items: clientItems } = JSON.parse(event.body);

    if (!orderID) {
      return { statusCode: 400, body: JSON.stringify({ error: 'orderID mancante' }) };
    }

    // Fonte di verità: gli articoli salvati alla CREAZIONE dell'ordine (validi,
    // impossibili da alterare dal browser). NON si usa più il fallback su
    // clientItems per decrementare le scorte: fidarsi del carrello mandato dal
    // browser in questa chiamata separata permetterebbe di dichiarare un
    // carrello diverso da quello effettivamente creato/pagato. Se il recupero
    // fallisce, blocchiamo la capture (il pagamento non viene incassato) e
    // logghiamo per gestione manuale, invece di procedere alla cieca.
    const pendingItems = await getPendingItems(orderID);

    if (!Array.isArray(pendingItems) || pendingItems.length === 0) {
      console.error(
        'paypal-capture-order: articoli pending non trovati/non validi per orderID',
        orderID,
        '— capture bloccata, richiede gestione manuale. clientItems ricevuti (solo per riferimento, NON usati):',
        clientItems
      );
      return {
        statusCode: 409,
        body: JSON.stringify({
          error: 'Impossibile verificare il carrello dell\'ordine. Il pagamento non è stato incassato, riprova o contatta il supporto.',
        }),
      };
    }

    const items = pendingItems;

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_API_BASE_URL}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Errore capture PayPal:', errText);
      throw new Error(`Capture PayPal fallita: ${response.status}`);
    }

    const details = await response.json();
    const status = details?.purchase_units?.[0]?.payments?.captures?.[0]?.status;
    if (details.status !== 'COMPLETED' && status !== 'COMPLETED') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Pagamento non completato', status: details.status }) };
    }

    // Decremento scorte solo ORA che l'incasso è confermato COMPLETED.
    // Chiave idempotenza = orderID PayPal, per sicurezza in caso di doppia capture.
    // Usa gli articoli reali salvati alla creazione dell'ordine (vedi pending-paypal-items.cjs),
    // non quelli mandati dal client in questa chiamata — altrimenti si potrebbe
    // dichiarare un carrello diverso da quello effettivamente pagato.
    try {
      const stockResult = await decrementStockOnce(orderID, items);
      if (!stockResult.ok) {
        console.error('Scorte esaurite a metà ordine (PayPal), orderID:', orderID, 'dettagli:', stockResult);
        await sendStockAlertEmail({
          source: 'paypal-capture-order',
          idempotencyKey: orderID,
          handle: stockResult.handle,
          remaining: stockResult.remaining,
          items,
        });
      }
    } catch (err) {
      console.error('Errore nel decremento scorte PayPal:', err);
      // Il pagamento è già incassato, non blocchiamo la risposta per un problema di scorte.
    }

    deletePendingItems(orderID).catch(() => {});

    // Estrazione buyer dalla risposta PayPal (stessa logica che prima stava nel
    // browser, in PayPalButton.tsx onApprove) — qui è più sicuro perché i dati
    // vengono letti direttamente dalla risposta di PayPal, non da input del client.
    let buyer;
    try {
      const shipping = details?.purchase_units?.[0]?.shipping;
      const payerName = details?.payer?.name;
      const name = shipping?.name?.full_name
        || (payerName ? `${payerName.given_name || ''} ${payerName.surname || ''}`.trim() : '');
      const a = shipping?.address;
      if (name || a) {
        buyer = {
          name: name || '',
          address: a
            ? `${[a.address_line_1, a.address_line_2].filter(Boolean).join(', ')}, ${a.postal_code || ''} ${a.admin_area_2 || ''}${a.admin_area_1 ? ' (' + a.admin_area_1 + ')' : ''} - ${a.country_code || ''}`
            : '',
        };
      }
    } catch {
      buyer = undefined;
    }

    // Il totale per il riepilogo interno è ricalcolato dal catalogo (stessa fonte
    // di verità usata in creazione ordine), non letto dalla risposta PayPal, per
    // restare coerente con il pattern già usato in generate-order-id.cjs.
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
    const paidTotal = parseFloat(details?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value)
      || itemsSum;

    let orderId = 'TRPLRG-000000-000-X';
    try {
      orderId = await generateOrderId(items);
    } catch {
      // Il pagamento è già incassato: non blocchiamo la risposta per un problema di order-id.
    }

    // Stesso token casuale usato per gli ordini Stripe/Google Pay: protegge
    // get-order-by-id.cjs dall'enumerazione dell'orderId.
    const accessTokenForOrder = crypto.randomBytes(16).toString('hex');

    await saveOrderDetails(orderId, {
      orderId,
      items: orderItems,
      total: paidTotal,
      buyer: buyer || null,
      accessToken: accessTokenForOrder,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, orderId, accessToken: accessTokenForOrder, buyer: buyer || null }),
    };
  } catch (err) {
    console.error('Errore in paypal-capture-order:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
