// Invia un'email di alert al venditore quando decrementStockOnce (stock.cjs)
// ritorna { ok: false, ... }, cioè un ordine è stato pagato/incassato ma le
// scorte per almeno un prodotto sono finite a metà elaborazione (race tra
// più acquisti quasi simultanei sull'ultimo pezzo).
//
// Usa l'API transazionale di Brevo (v3/smtp/email), stessa BREVO_API_KEY già
// in uso per l'iscrizione newsletter (subscribe-newsletter.cjs) — nessuna
// chiave nuova da configurare.
//
// COME CONFIGURARLA (in aggiunta a BREVO_API_KEY, già presente):
// - SELLER_ALERT_EMAIL: indirizzo del venditore che riceve l'alert
// - BREVO_SENDER_EMAIL: mittente, DEVE essere un'email verificata su Brevo
//   (Brevo -> Settings -> Senders & IP -> Senders), altrimenti l'invio fallisce

const BREVO_EMAIL_API = 'https://api.brevo.com/v3/smtp/email';

// source = quale funzione ha rilevato il problema ('paypal-capture-order',
// 'google-pay-charge', 'stripe-webhook'), per capire subito da dove ripartire.
async function sendStockAlertEmail({ source, idempotencyKey, handle, remaining, items }) {
  const apiKey = process.env.BREVO_API_KEY;
  const to = process.env.SELLER_ALERT_EMAIL;
  const sender = process.env.BREVO_SENDER_EMAIL;

  if (!apiKey || !to || !sender) {
    console.error(
      'stock-alert: impossibile inviare l\'email di alert scorte esaurite (BREVO_API_KEY, SELLER_ALERT_EMAIL o BREVO_SENDER_EMAIL mancante). Dettagli:',
      { source, idempotencyKey, handle, remaining }
    );
    return;
  }

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

  try {
    const response = await fetch(BREVO_EMAIL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { email: sender, name: 'TRPLRG Store — Alert scorte' },
        to: [{ email: to }],
        subject: `[TRPLRG] Scorte esaurite a metà ordine — ${handle || 'prodotto sconosciuto'}`,
        textContent,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('stock-alert: Brevo ha rifiutato l\'invio dell\'email di alert:', response.status, errText);
    }
  } catch (err) {
    console.error('stock-alert: errore di rete nell\'invio dell\'email di alert scorte:', err);
  }
}

module.exports = { sendStockAlertEmail };
