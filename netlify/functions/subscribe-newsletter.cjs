// Funzione serverless (Netlify Function) che iscrive un'email alla newsletter su Brevo.
// Gira sul server di Netlify, mai nel browser: qui dentro è sicuro usare la chiave API Brevo.
//
// COME CONFIGURARLA:
// 1. Su Netlify: Site settings -> Environment variables -> aggiungi BREVO_API_KEY (la chiave che inizia con xkeysib-...)
// 2. Non serve incollarla da nessun'altra parte, nè nel codice nè in chat.

const BREVO_LIST_ID = 3; // ID della lista "Newsletter TRPLRG" su Brevo

// Rate limiting semplice: max 3 richieste per IP ogni 60 secondi.
// Vive in memoria del processo Netlify Function — funziona finché la stessa
// istanza "calda" gestisce le richieste, si azzera ad ogni cold start. Non è
// perfetto (un bot distribuito su più IP lo aggira), ma blocca lo spam
// accidentale o da un singolo script senza bisogno di un database esterno.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;
const requestLog = new Map(); // ip -> array di timestamp

// Senza pulizia, ogni IP che ha mai chiamato questa function una volta resta
// per sempre nella Map (anche con l'array di timestamp vuoto dopo il filtro),
// finché l'istanza Netlify Function resta "calda": su un sito con traffico
// continuo può non fare mai un cold start per ore/giorni, quindi la Map
// cresce indefinitamente (memory leak). Ogni tot chiamate, o comunque non più
// spesso di una volta ogni finestra di rate limit, rimuoviamo le voci con
// SOLO timestamp scaduti (nessuna richiesta recente per quell'IP).
const CLEANUP_INTERVAL_MS = RATE_LIMIT_WINDOW_MS;
let lastCleanup = Date.now();

function cleanupExpiredEntries(now) {
  for (const [ip, timestamps] of requestLog) {
    const fresh = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) {
      requestLog.delete(ip);
    } else if (fresh.length !== timestamps.length) {
      requestLog.set(ip, fresh);
    }
  }
  lastCleanup = now;
}

function isRateLimited(ip) {
  const now = Date.now();

  if (now - lastCleanup >= CLEANUP_INTERVAL_MS) {
    cleanupExpiredEntries(now);
  }

  const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || 'unknown';
  if (isRateLimited(ip)) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Troppe richieste, riprova tra un minuto.' }) };
  }

  try {
    const { email } = JSON.parse(event.body);

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email non valida' }) };
    }

    // Double opt-in (GDPR): se BREVO_DOI_TEMPLATE_ID è impostata su Netlify, usiamo il
    // flusso di conferma Brevo (il contatto entra in lista SOLO dopo il click sul link
    // nella email di conferma). Se non è impostata, comportamento invariato (singolo opt-in).
    const doiTemplateId = process.env.BREVO_DOI_TEMPLATE_ID;
    const brevoUrl = doiTemplateId
      ? 'https://api.brevo.com/v3/contacts/doubleOptinConfirmation'
      : 'https://api.brevo.com/v3/contacts';
    const brevoBody = doiTemplateId
      ? { email: email.trim(), templateId: Number(doiTemplateId), redirectionUrl: 'https://trplrg.com/' }
      : { email: email.trim(), listIds: [BREVO_LIST_ID], updateEnabled: true }; // se l'email esiste già, la aggiorna invece di dare errore

    const response = await fetch(brevoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify(brevoBody),
    });

    // Brevo risponde 204 (nessun contenuto) quando va tutto bene
    if (response.ok) {
      return { statusCode: 200, body: JSON.stringify({ success: true, doi: !!doiTemplateId }) };
    }

    const data = await response.json().catch(() => ({}));

    // Se il contatto esiste già ed è identico, Brevo a volte risponde con questo codice: trattalo come successo
    if (data.code === 'duplicate_parameter') {
      return { statusCode: 200, body: JSON.stringify({ success: true, doi: !!doiTemplateId }) };
    }

    return { statusCode: response.status, body: JSON.stringify({ error: data.message || 'Errore Brevo' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
