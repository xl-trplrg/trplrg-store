// Zone e costi di spedizione per paese, basati sul listino ufficiale BRT
// "Tariffe Privati" (tabella Europa) + una fascia Nord America (International Air, zona A).
//
// GEMELLO SERVER-SIDE: netlify/functions/lib/shipping.cjs — questo file serve solo per
// mostrare il menu a tendina e il totale sul carrello. Il prezzo VERO applicato al
// pagamento è sempre ricalcolato dal server con quel file. Se cambi un prezzo qui,
// cambialo anche là, altrimenti il totale mostrato in carrello e quello addebitato
// davvero da Stripe/Google Pay non torneranno uguali.

export interface ShippingCountry {
  code: string;
  label: string;
  cost: number;
}

export const shippingCountries: ShippingCountry[] = [
  { code: 'IT', label: 'Italia', cost: 6 },

  // BRT Europa Zona 1
  { code: 'FR', label: 'Francia', cost: 10 },
  { code: 'DE', label: 'Germania', cost: 10 },
  { code: 'AT', label: 'Austria', cost: 10 },
  { code: 'NL', label: 'Paesi Bassi', cost: 10 },
  { code: 'HR', label: 'Croazia', cost: 10 },
  { code: 'HU', label: 'Ungheria', cost: 10 },
  { code: 'SI', label: 'Slovenia', cost: 10 },

  // BRT Europa Zona 2
  { code: 'ES', label: 'Spagna', cost: 12 },
  { code: 'BE', label: 'Belgio', cost: 12 },
  { code: 'PL', label: 'Polonia', cost: 12 },
  { code: 'BG', label: 'Bulgaria', cost: 12 },
  { code: 'CZ', label: 'Repubblica Ceca', cost: 12 },
  { code: 'LU', label: 'Lussemburgo', cost: 12 },

  // BRT Europa Zona 3
  { code: 'DK', label: 'Danimarca', cost: 14 },
  { code: 'PT', label: 'Portogallo', cost: 14 },
  { code: 'GR', label: 'Grecia', cost: 14 },
  { code: 'SK', label: 'Slovacchia', cost: 14 },
  { code: 'RO', label: 'Romania', cost: 14 },

  // BRT Europa Zona 4 (+ Svizzera, stessa zona BRT pur non essendo UE)
  { code: 'SE', label: 'Svezia', cost: 18 },
  { code: 'FI', label: 'Finlandia', cost: 18 },
  { code: 'EE', label: 'Estonia', cost: 18 },
  { code: 'LV', label: 'Lettonia', cost: 18 },
  { code: 'LT', label: 'Lituania', cost: 18 },
  { code: 'IE', label: 'Irlanda', cost: 18 },
  { code: 'GB', label: 'Regno Unito', cost: 18 },
  { code: 'CH', label: 'Svizzera', cost: 18 },

  // BRT International Air Zona A
  { code: 'US', label: 'Stati Uniti', cost: 28 },
  { code: 'CA', label: 'Canada', cost: 28 },
  // "Resto del mondo" rimosso: Stripe accetta solo indirizzi nei paesi elencati
  // sopra (allowed_countries in create-checkout-session.cjs) — un cliente che
  // avesse selezionato ROW sarebbe arrivato su Stripe senza poter completare
  // l'ordine. Se aggiungi altri paesi, aggiungili qui E nella lista
  // allowed_countries lato server, altrimenti succede di nuovo.
];

export function getShippingCost(countryCode: string): number {
  const found = shippingCountries.find(c => c.code === countryCode);
  return found ? found.cost : 35;
}
