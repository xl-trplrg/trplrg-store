// Ottiene un access token OAuth2 da PayPal usando le credenziali server-side
// (mai esposte al browser). Usato sia da paypal-create-order.cjs sia da
// paypal-capture-order.cjs, stesso principio delle altre "lib" del progetto
// (prices.cjs, shipping.cjs): un'unica fonte di verità, niente duplicazioni.
//
// COME CONFIGURARLA: PAYPAL_CLIENT_SECRET e VITE_PAYPAL_CLIENT_ID sono già
// presenti su Netlify come variabili d'ambiente (il secret non va mai messo
// nel codice o in chat).

async function getPayPalAccessToken() {
  const clientId = process.env.VITE_PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Credenziali PayPal non configurate');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://api.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Token PayPal non ottenuto: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

module.exports = { getPayPalAccessToken };
