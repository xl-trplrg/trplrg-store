// Rate limiting semplice per IP, in memoria del processo Netlify Function.
// Stesso pattern già usato in subscribe-newsletter.cjs, estratto qui per
// poterlo riusare anche in altri endpoint pubblici senza duplicare la logica
// di pulizia. Vive finché la stessa istanza "calda" gestisce le richieste,
// si azzera ad ogni cold start: non è perfetto (un bot distribuito su più IP
// lo aggira), ma blocca lo spam accidentale o da un singolo script senza
// bisogno di un database esterno.
//
// Ogni endpoint che lo usa ha il proprio Map indipendente (createRateLimiter
// ne crea uno nuovo), così i limiti di un endpoint non consumano quelli di
// un altro.

function createRateLimiter({ windowMs, max }) {
  const requestLog = new Map(); // ip -> array di timestamp
  let lastCleanup = Date.now();

  function cleanupExpiredEntries(now) {
    for (const [ip, timestamps] of requestLog) {
      const fresh = timestamps.filter((t) => now - t < windowMs);
      if (fresh.length === 0) {
        requestLog.delete(ip);
      } else if (fresh.length !== timestamps.length) {
        requestLog.set(ip, fresh);
      }
    }
    lastCleanup = now;
  }

  return function isRateLimited(ip) {
    const now = Date.now();

    if (now - lastCleanup >= windowMs) {
      cleanupExpiredEntries(now);
    }

    const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < windowMs);
    timestamps.push(now);
    requestLog.set(ip, timestamps);
    return timestamps.length > max;
  };
}

function getClientIp(event) {
  return event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || 'unknown';
}

module.exports = { createRateLimiter, getClientIp };
