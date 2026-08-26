// Usato dal quick-buy PayPal in ProductDetail: mentre il cliente sceglie il paese
// DENTRO al popup PayPal (senza nessun menu sul sito), PayPal chiama questo endpoint
// per sapere quanto vale la spedizione, così può aggiornare il totale prima che il
// cliente confermi.
const { getShippingCost } = require('./lib/shipping.cjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const country = event.queryStringParameters?.country;
  if (!country) {
    return { statusCode: 400, body: JSON.stringify({ error: 'country mancante' }) };
  }

  const shippingCost = getShippingCost(country.toUpperCase());
  return { statusCode: 200, body: JSON.stringify({ shippingCost }) };
};
