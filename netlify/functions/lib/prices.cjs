// Unica fonte di verità per i prezzi lato server, usata sia da Stripe
// (create-checkout-session.cjs) sia da Google Pay (google-pay-charge.cjs).
// Se cambi un prezzo, cambialo SOLO qui: entrambe le funzioni lo leggono da qui,
// quindi restano sempre sincronizzate tra loro.
// Deve restare coerente con src/data/products.ts (handle + price) — quello è
// il file che decide cosa vede il cliente sul sito, questo decide cosa gli
// viene davvero addebitato.
const PRICES = {
  'xl-vinile': { name: 'TROPPO LARGO Vinyl', price: 30, img: '/products/vinile.jpg' },
  'xl-cd': { name: 'TROPPO LARGO CD Edition', price: 20, img: '/products/cd.jpg' },
  'xl-maglietta': { name: 'YATP T-Shirt Bianca', price: 25, img: '/products/tshirt-front.jpg' },
  'xl-felpa': { name: 'TROPPO LARGO - Hoodie', price: 40, img: '/products/hoodie-front.jpg' },
  // Prezzo 0: nell'uso normale del sito questo prodotto si scarica direttamente
  // (mai messo nel carrello), ma lo teniamo qui per sicurezza — se per qualsiasi
  // motivo finisse in un carrello e arrivasse al checkout, il server lo riconosce
  // invece di rispondere "Prodotto sconosciuto" e bloccare l'intero ordine.
  'xl-album-digitale': { name: 'TROPPO LARGO — Album Digitale', price: 0, img: '/products/album-digitale.jpg', noShipping: true, downloadUrl: '/downloads/XL-TRPLRG-2026.zip' },
  // TEST — rimuovere insieme alla voce in src/data/products.ts a test completato.
  'xl-test-checkout': { name: 'TEST — Prodotto di verifica checkout', price: 1, img: '/products/album-digitale.jpg', noShipping: true },
  'xl-test-checkout-spedizione': { name: 'TEST — Verifica checkout con spedizione', price: 1, img: '/products/album-digitale.jpg', testShippingOverride: 1 },
};

module.exports = { PRICES };
