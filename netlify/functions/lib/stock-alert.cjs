// Invia email di alert al venditore quando qualcosa richiede una verifica
// manuale su un ordine già pagato. Usa l'API transazionale di Brevo
// (v3/smtp/email), stessa BREVO_API_KEY già in uso per l'iscrizione
// newsletter (subscribe-newsletter.cjs) — nessuna chiave nuova da configurare.
//
// COME CONFIGURARLA (in aggiunta a BREVO_API_KEY, già presente):
// - SELLER_ALERT_EMAIL: indirizzo del venditore che riceve l'alert
// - BREVO_SENDER_EMAIL: mittente, DEVE essere un'email verificata su Brevo
//   (Brevo -> Settings -> Senders & IP -> Senders), altrimenti l'invio fallisce

const BREVO_EMAIL_API = 'https://api.brevo.com/v3/smtp/email';

async function sendBrevoAlert(subject, textContent) {
  const apiKey = process.env.BREVO_API_KEY;
  const to = process.env.SELLER_ALERT_EMAIL;
  const sender = process.env.BREVO_SENDER_EMAIL;

  if (!apiKey || !to || !sender) {
    console.error(
      'stock-alert: impossibile inviare l\'email di alert (BREVO_API_KEY, SELLER_ALERT_EMAIL o BREVO_SENDER_EMAIL mancante). Contenuto previsto:',
      { subject, textContent }
    );
    return;
  }

  try {
    const response = await fetch(BREVO_EMAIL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { email: sender, name: 'TRPLRG Store — Alert' },
        to: [{ email: to }],
        subject,
        textContent,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('stock-alert: Brevo ha rifiutato l\'invio dell\'email di alert:', response.status, errText);
    }
  } catch (err) {
    console.error('stock-alert: errore di rete nell\'invio dell\'email di alert:', err);
  }
}

// source = quale funzione ha rilevato il problema ('paypal-capture-order',
// 'google-pay-charge', 'stripe-webhook'), per capire subito da dove ripartire.
async function sendStockAlertEmail({ source, idempotencyKey, handle, remaining, items }) {
  const itemsList = Array.isArray(items)
    ? items.map((i) => `- ${i.handle}${i.size ? ` (taglia ${i.size})` : ''} x${i.quantity ?? 1}`).join('\n')
    : 'n/d';

  const textContent = [
    `Un ordine è stato pagato ma il decremento scorte è FALLITO (scorte esaurite a metà elaborazione).`,
    ``,
    `Origine: ${source}`,
    `Riferimento pagamento (idempotency key): ${idempotencyKey || 'n/d'}`,
    `Prodotto esaurito: ${handle || 'n/d'}`,
    `Scorte rimaste al momento del fallimento: ${typeof remaining === 'number' ? remaining : 'n/d'}`,
    ``,
    `Articoli dell'ordine:`,
    itemsList,
    ``,
    `Azione richiesta: verificare manualmente la disponibilità reale del prodotto e contattare il cliente se necessario (l'ordine risulta comunque incassato).`,
  ].join('\n');

  await sendBrevoAlert(`[TRPLRG] Scorte esaurite a metà ordine — ${handle || 'prodotto sconosciuto'}`, textContent);
}

// Inviato quando il paese usato per calcolare la spedizione (scelto dal
// cliente nel menu del sito, PRIMA di iniziare il pagamento) risulta diverso
// dal paese dell'indirizzo di spedizione REALE raccolto poi da
// Stripe/PayPal/Google Pay — e la spedizione corretta per quell'indirizzo
// sarebbe costata di più. Non blocchiamo né correggiamo l'addebito in
// automatico (rischioso su un pagamento già concluso): segnaliamo solo,
// così il venditore può decidere se richiedere la differenza al cliente,
// assorbirla, o verificare che non sia un tentativo di sottofatturazione.
async function sendShippingMismatchAlert({ source, reference, orderId, pricedCountry, realCountry, charged, shouldHaveBeen }) {
  const diff = (typeof charged === 'number' && typeof shouldHaveBeen === 'number')
    ? (shouldHaveBeen - charged).toFixed(2)
    : 'n/d';

  const textContent = [
    `Un ordine pagato ha un indirizzo di spedizione reale diverso dal paese usato per calcolare la spedizione, con un costo corretto più alto di quello addebitato.`,
    ``,
    `Origine: ${source}`,
    `Riferimento ordine: ${orderId || 'n/d'}`,
    `Riferimento pagamento: ${reference || 'n/d'}`,
    `Paese usato per il calcolo (scelto sul sito prima del pagamento): ${pricedCountry || 'n/d'}`,
    `Paese reale dell'indirizzo di spedizione: ${realCountry || 'n/d'}`,
    `Spedizione addebitata: ${typeof charged === 'number' ? charged.toFixed(2) + ' €' : 'n/d'}`,
    `Spedizione corretta per il paese reale: ${typeof shouldHaveBeen === 'number' ? shouldHaveBeen.toFixed(2) + ' €' : 'n/d'}`,
    `Differenza non addebitata: ${diff !== 'n/d' ? diff + ' €' : 'n/d'}`,
    ``,
    `Azione richiesta: verificare l'ordine e decidere se contattare il cliente per la differenza di spedizione.`,
  ].join('\n');

  await sendBrevoAlert(`[TRPLRG] Spedizione sottostimata — ordine ${orderId || reference || 'sconosciuto'}`, textContent);
}

module.exports = { sendStockAlertEmail, sendShippingMismatchAlert };
