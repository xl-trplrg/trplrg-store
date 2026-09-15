// Funzione serverless chiamata dal browser SOLO dopo che un pagamento PayPal o Google Pay
// è già andato a buon fine (il pagamento vero avviene altrove: PayPal SDK o google-pay-charge.cjs).
// Questa funzione si occupa solo di generare un Order ID progressivo, mai di soldi.

const crypto = require('crypto');
const { generateOrderId } = require('./lib/order-id.cjs');
const { saveOrderDetails } = require('./lib/orders-store.cjs');
const { PRICES } = require('./lib/prices.cjs');
const { createRateLimiter, getClientIp } = require('./lib/rate-limit.cjs');

// Endpoint pubblico e non autenticato: senza un limite, chiunque può
// chiamarlo ripetutamente per riempire lo storage ordini (Blobs) e bruciare
// numeri del contatore giornaliero (buchi/ordini fantasma nella numerazione),
// senza mai dover davvero pagare nulla. Il commento "chiamata SOLO dopo un
// pagamento riuscito" nell'intestazione del file è solo un'assunzione sul
// flusso previsto, non un controllo reale: questo limite è la prima difesa
// concreta. 10 richieste al minuto per IP bastano ampiamente a un cliente
// reale (anche con più acquisti/download rapidi) e rallentano di molto
// qualsiasi abuso automatizzato.
const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 10 });

// Validazione/sanitizzazione del `buyer` ricevuto dal client, stessa logica
// usata in google-pay-charge.cjs. Qui il buyer è opzionale (i download
// digitali gratuiti chiamano questa funzione senza alcun buyer), quindi non
// blocchiamo la richiesta se manca: puliamo solo la FORMA dei dati prima di
// salvarli, per evitare che un client malevolo scriva su Blobs campi enormi
// o con caratteri di controllo (es. a-capo, utilizzabili per header
// injection se questo testo finisse mai in un'intestazione email).
const MAX_BUYER_FIELD_LENGTH = 300;

function sanitizeBuyerField(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t\x00-\x1F\x7F]+/g, ' ').trim().slice(0, MAX_BUYER_FIELD_LENGTH);
}

// Ritorna il buyer ripulito, oppure null se assente o senza la forma minima
// attesa (in quel caso lo trattiamo come "nessun buyer", non blocchiamo
// l'ordine: questa funzione non incassa soldi, l'addebito è già avvenuto
// altrove prima che venga chiamata).
function sanitizeBuyer(rawBuyer) {
  if (rawBuyer === undefined || rawBuyer === null) return null;
  if (typeof rawBuyer !== 'object' || Array.isArray(rawBuyer)) return null;

  const name = sanitizeBuyerField(rawBuyer.name);
  const address = sanitizeBuyerField(rawBuyer.address);

  if (!name && !address) return null;
  return { name, address };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (isRateLimited(getClientIp(event))) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Troppe richieste, riprova tra un minuto.' }) };
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

    const sanitizedBuyer = sanitizeBuyer(buyer);

    // Token casuale imprevedibile a 128 bit (16 byte): solo chi lo riceve in
    // questa risposta (il vero acquirente, nel suo browser) può poi rileggere
    // i dettagli di QUESTO ordine tramite get-order-by-id.cjs. Senza il
    // token, conoscere/indovinare il solo orderId non basta più a leggere
    // nome/indirizzo di un altro cliente. Stessa lunghezza usata in
    // paypal-capture-order.cjs e google-pay-charge.cjs.
    const accessToken = crypto.randomBytes(16).toString('hex');

    await saveOrderDetails(orderId, { orderId, items: orderItems, total, buyer: sanitizedBuyer, accessToken });

    return { statusCode: 200, body: JSON.stringify({ orderId, accessToken }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
