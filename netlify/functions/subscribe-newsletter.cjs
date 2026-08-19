// Funzione serverless (Netlify Function) che iscrive un'email alla newsletter su Brevo.
// Gira sul server di Netlify, mai nel browser: qui dentro è sicuro usare la chiave API Brevo.
//
// COME CONFIGURARLA:
// 1. Su Netlify: Site settings -> Environment variables -> aggiungi BREVO_API_KEY (la chiave che inizia con xkeysib-...)
// 2. Non serve incollarla da nessun'altra parte, nè nel codice nè in chat.

const BREVO_LIST_ID = 3; // ID della lista "Newsletter TRPLRG" su Brevo

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email } = JSON.parse(event.body);

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email non valida' }) };
    }

    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        email: email.trim(),
        listIds: [BREVO_LIST_ID],
        updateEnabled: true, // se l'email esiste già, la aggiorna invece di dare errore
      }),
    });

    // Brevo risponde 204 (nessun contenuto) quando va tutto bene
    if (response.ok) {
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    const data = await response.json().catch(() => ({}));

    // Se il contatto esiste già ed è identico, Brevo a volte risponde con questo codice: trattalo come successo
    if (data.code === 'duplicate_parameter') {
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: response.status, body: JSON.stringify({ error: data.message || 'Errore Brevo' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
