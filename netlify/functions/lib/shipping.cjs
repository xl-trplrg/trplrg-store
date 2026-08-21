// Costo di spedizione per paese, basato sulle zone del listino ufficiale BRT
// "Tariffe Privati" (tabella Europa, fascia peso 0-2 Kg, più una fascia Nord America
// presa dalla tabella International Air BRT — zona A). Fonte di verità server-side:
// sia create-checkout-session.cjs (Stripe) sia google-pay-charge.cjs la usano da qui,
// così non si disallineano. Lato client, la stessa tabella è duplicata (con le etichette
// in italiano per il menu a tendina) in src/data/shipping.ts: se cambi un prezzo qui,
// cambialo anche lì.

const ZONE_PRICES = {
  IT: 6,   // Italia — invariato, come deciso
  EU1: 10, // BRT Europa Zona 1: Francia, Germania, Austria, Paesi Bassi, Croazia, Ungheria, Slovenia
  EU2: 12, // BRT Europa Zona 2: Spagna, Belgio, Polonia, Bulgaria, Rep. Ceca, Lussemburgo
  EU3: 14, // BRT Europa Zona 3: Danimarca, Portogallo, Grecia, Slovacchia, Romania
  EU4: 18, // BRT Europa Zona 4 (+ Svizzera, fuori UE ma stessa zona BRT): Svezia, Finlandia, Estonia, Lettonia, Lituania, Irlanda, Regno Unito, Svizzera
  NA: 28,  // BRT International Air Zona A: USA, Canada
  ROW: 35, // Resto del mondo — fascia unica (copre le zone B-E del listino aereo BRT)
};

const COUNTRY_ZONE = {
  IT: 'IT',
  FR: 'EU1', DE: 'EU1', AT: 'EU1', NL: 'EU1', HR: 'EU1', HU: 'EU1', SI: 'EU1',
  ES: 'EU2', BE: 'EU2', PL: 'EU2', BG: 'EU2', CZ: 'EU2', LU: 'EU2',
  DK: 'EU3', PT: 'EU3', GR: 'EU3', SK: 'EU3', RO: 'EU3',
  SE: 'EU4', FI: 'EU4', EE: 'EU4', LV: 'EU4', LT: 'EU4', IE: 'EU4', GB: 'EU4', CH: 'EU4',
  US: 'NA', CA: 'NA',
};

// countryCode = codice ISO a 2 lettere (es. 'IT', 'FR', 'US'). Paese non mappato -> Resto del mondo.
function getShippingCost(countryCode) {
  const zone = COUNTRY_ZONE[countryCode] || 'ROW';
  return ZONE_PRICES[zone];
}

module.exports = { getShippingCost, COUNTRY_ZONE, ZONE_PRICES };
