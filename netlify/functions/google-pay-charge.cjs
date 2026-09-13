// Funzione serverless (Netlify Function) che incassa un pagamento Google Pay tramite Stripe.
// Riceve il "token" generato da Google Pay (già passato attraverso Stripe come gateway) e lo
// usa per addebitare la carta scelta dal cliente.
//
// COME CONFIGURARLA: usa la stessa STRIPE_SECRET_KEY già impostata su Netlify per
// create-checkout-session.cjs — nessuna configurazione aggiuntiva richiesta qui.

const crypto = require('crypto');
const Stripe = require('stripe');
const { generateOrderId } = require('./lib/order-id.cjs');
const { getShippingCost } = require('./lib/shipping.cjs');
const { saveOrderDetails } = require('./lib/orders-store.cjs');
const { hasEnoughStock, decrementStockOnce, exceedsMaxPerProduct } = require('./lib/stock.cjs');
const { sendStockAlertEmail } = require('./lib/stock-alert.cjs');

// Stessa fonte di verità prezzi usata da create-checkout-session.cjs.
// Se aggiorni un prezzo in un posto, aggiornalo anche nell'altro.
const { PRICES } = require('./lib/prices.cjs');

// Validazione server-side dell'indirizzo `buyer`. A differenza di Stripe
// (shipping_details letto dalla sessione già confermata) e PayPal (shipping
// letto dalla risposta di capture), qui il `buyer` arriva così com'è dal
// browser (Google Pay -> paymentData.shippingAddress, mai verificato da noi):
// un client malevolo potrebbe mandare campi mancanti, enormi, o con caratteri
// di controllo (es. a-capo, usati per attacchi di header injection se questo
// valore finisse mai in un'intestazione email). Qui NON validiamo l'identità
// del cliente (non è quello il rischio: l'importo resta sempre ricalcolato
// sopra dal catalogo server-side) ma la FORMA dei dati prima di salvarli.
const MAX_BUYER_FIELD_LENGTH = 300;

function sanitizeBuyerField(value) {
  if (typeof value !== 'string') return '';
  // Rimuove newline/caratteri di controllo (evita header injection se questo
  // testo finisse in un'intestazione email o in un CSV) e taglia la lunghezza.
  return value.replace(/[\r\n\t\x00-\x1F\x7F]+/g, ' ').trim().slice(0, MAX_BUYER_FIELD_LENGTH);
}

// Ritorna { valid: true, buyer } con i campi puliti, oppure { valid: false }
// se il buyer mandato dal client non ha la forma minima attesa (non blocca
// l'intero ordine da solo: la spedizione resta comunque richiesta lato
// Google Pay per i prodotti fisici, quindi un buyer assente/invalido qui
// è un'anomalia da rifiutare prima di addebitare la carta).
function validateBuyer(rawBuyer) {
  if (rawBuyer === undefined || rawBuyer === null) return { valid: true, buyer: null };
  if (typeof rawBuyer !== 'object' || Array.isArray(rawBuyer)) return { valid: false };

  const name = sanitizeBuyerField(rawBuyer.name);
  const address = sanitizeBuyerField(rawBuyer.address);

  if (!name || !address) return { valid: false };

  return { valid: true, buyer: { name, address } };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { tokenId, items, country, email, buyer } = JSON.parse(event.body);

    if (!tokenId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Token mancante' }) };
    }
    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Carrello vuoto' }) };
    }

    // Quantità assurde bloccate a prescindere dalle scorte disponibili.
    const qtyCheck = exceedsMaxPerProduct(items);
    if (!qtyCheck.ok) {
      return { statusCode: 400, body: JSON.stringify({ error: `Massimo ${qtyCheck.max} pezzi per prodotto`, handle: qtyCheck.handle }) };
    }

    // Controllo scorte PRIMA di addebitare la carta: qui il pagamento è
    // immediato (niente redirect esterno), quindi ha senso bloccare subito.
    const stockCheck = await hasEnoughStock(items);
    if (!stockCheck.ok) {
      return { statusCode: 409, body: JSON.stringify({ error: 'Prodotto esaurito', handle: stockCheck.handle }) };
    }

    // Totale calcolato SOLO dal server, mai da quello che manda il browser.
    let amount = 0;
    for (const item of items) {
      const known = PRICES[item.handle];
      if (!known) throw new Error(`Prodotto sconosciuto: ${item.handle}`);
      amount += known.price * Math.max(1, parseInt(item.quantity, 10) || 1);
    }
    const allExemptFromShipping = items.every((item) => PRICES[item.handle]?.noShipping);

    // Validazione server-side dell'indirizzo buyer, PRIMA di addebitare la
    // carta. Se il carrello richiede una spedizione fisica, un buyer
    // mancante o malformato blocca l'addebito (i dati verrebbero comunque
    // usati per spedire il prodotto).
    const buyerCheck = validateBuyer(buyer);
    if (!buyerCheck.valid) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Indirizzo di spedizione non valido' }) };
    }
    if (!allExemptFromShipping && !buyerCheck.buyer) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Indirizzo di spedizione mancante' }) };
    }
    const validatedBuyer = buyerCheck.buyer;
    const testOverride = items.every((item) => typeof PRICES[item.handle]?.testShippingOverride === 'number')
      ? PRICES[items[0].handle].testShippingOverride
      : undefined;
    if (!allExemptFromShipping) {
      amount += testOverride ?? getShippingCost(country);
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'eur',
      payment_method_data: {
        type: 'card',
        card: { token: tokenId },
      },
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      // Stripe manda automaticamente la ricevuta a questo indirizzo se valorizzato
      // (nessuna impostazione aggiuntiva richiesta lato dashboard per questo campo specifico).
      receipt_email: typeof email === 'string' && email.includes('@') ? email : undefined,
    });

    if (paymentIntent.status === 'succeeded') {
      // Decremento scorte solo ORA che l'addebito è confermato riuscito.
      // Chiave idempotenza = id del paymentIntent, per sicurezza in caso di retry.
      try {
        const stockResult = await decrementStockOnce(paymentIntent.id, items);
        if (!stockResult.ok) {
          console.error('Scorte esaurite a metà ordine (Google Pay), paymentIntent:', paymentIntent.id, 'dettagli:', stockResult);
          await sendStockAlertEmail({
            source: 'google-pay-charge',
            idempotencyKey: paymentIntent.id,
            handle: stockResult.handle,
            remaining: stockResult.remaining,
            items,
          });
        }
      } catch (err) {
        console.error('Errore nel decremento scorte Google Pay:', err);
        // Il pagamento è già riuscito, non blocchiamo la risposta per un problema di scorte.
      }

      let orderId = 'TRPLRG-000000-000-X';
      try {
        orderId = await generateOrderId(items);
      } catch {
        // il pagamento è già riuscito, non blocchiamo la risposta per un problema di order-id
      }

      // Salviamo una copia dei dettagli ordine, così la pagina di conferma
      // sopravvive anche a un refresh (Google Pay non passa per un redirect
      // esterno come Stripe Checkout, quindi non c'è un session_id da riusare).
      const orderItems = items.map((item) => {
        const known = PRICES[item.handle];
        return {
          name: item.size ? `${known?.name || item.handle} — Taglia ${item.size}` : (known?.name || item.handle),
          quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
          amount: (known?.price || 0) * Math.max(1, parseInt(item.quantity, 10) || 1),
          image: known?.img || null,
          downloadUrl: known?.downloadUrl || null,
        };
      });
      // Stesso token casuale usato per gli ordini PayPal (vedi generate-order-id.cjs):
      // protegge get-order-by-id.cjs dall'enumerazione dell'orderId.
      const accessToken = crypto.randomBytes(16).toString('hex');

      await saveOrderDetails(orderId, {
        orderId,
        items: orderItems,
        total: amount,
        buyer: validatedBuyer,
        accessToken,
      });

      return { statusCode: 200, body: JSON.stringify({ success: true, orderId, accessToken }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Pagamento non completato', status: paymentIntent.status }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
