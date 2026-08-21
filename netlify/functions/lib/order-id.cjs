// Genera un Order ID tipo TRPLRG-082126-001-F2T
// Formato: TRPLRG-MMGGAA-NNN-SUFFISSO
//  - MMGGAA: mese/giorno/anno(2 cifre), fuso orario Europe/Rome
//  - NNN: numero progressivo del giorno (riparte da 001 ogni giorno), salvato su Netlify Blobs
//  - SUFFISSO: per ogni tipo di prodotto presente nell'ordine, in ordine alfabetico (C, F, T, V):
//    se quantità 1 -> solo la lettera (es. "F"), se quantità >1 -> numero+lettera (es. "2T")

const { getStore } = require('@netlify/blobs');

const LETTERS = {
  'xl-cd': 'C',
  'xl-felpa': 'F',
  'xl-maglietta': 'T',
  'xl-vinile': 'V',
  'xl-album-digitale': 'D',
};

// Su questo sito Netlify non inietta automaticamente le credenziali di Blobs
// nella function (errore "MissingBlobsEnvironmentError"), quindi le passiamo
// a mano tramite due variabili d'ambiente configurate su Netlify:
// BLOBS_SITE_ID e BLOBS_TOKEN. Se un giorno l'iniezione automatica di Netlify
// dovesse iniziare a funzionare, questa funzione continua a usare comunque
// le variabili esplicite se presenti, altrimenti torna al comportamento di default.
function getOrderCountersStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'order-counters', siteID, token });
  }
  return getStore('order-counters');
}

function datePartsRome() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  return { mm: get('month'), dd: get('day'), yy: get('year') };
}

function buildSuffix(items) {
  const qtyByLetter = {};
  for (const item of items) {
    const letter = LETTERS[item.handle];
    if (!letter) continue;
    qtyByLetter[letter] = (qtyByLetter[letter] || 0) + (Math.max(1, parseInt(item.quantity, 10) || 1));
  }
  return Object.keys(qtyByLetter)
    .sort()
    .map((letter) => (qtyByLetter[letter] === 1 ? letter : `${qtyByLetter[letter]}${letter}`))
    .join('');
}

async function generateOrderId(items) {
  const { mm, dd, yy } = datePartsRome();
  const dateKey = `${yy}-${mm}-${dd}`;

  let progressive = '000';
  try {
    const store = getOrderCountersStore();
    let current = 0;
    try {
      const existing = await store.get(dateKey, { type: 'json' });
      if (typeof existing === 'number') current = existing;
    } catch {
      current = 0;
    }
    const next = current + 1;
    await store.setJSON(dateKey, next);
    progressive = String(next).padStart(3, '0');
  } catch (err) {
    // Logghiamo l'errore vero nei log della function Netlify (Netlify UI -> Functions -> logs)
    // così la prossima volta si vede subito perché Blobs non ha scritto nulla,
    // invece di scoprirlo solo dal fatto che lo store risulta vuoto.
    console.error('Netlify Blobs error in generateOrderId:', err);
    progressive = String(Date.now()).slice(-3);
  }

  const suffix = buildSuffix(items) || 'X';

  return `TRPLRG-${mm}${dd}${yy}-${progressive}-${suffix}`;
}

module.exports = { generateOrderId };
