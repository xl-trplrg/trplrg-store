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
};

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

  const store = getStore('order-counters');
  let current = 0;
  try {
    const existing = await store.get(dateKey, { type: 'json' });
    if (typeof existing === 'number') current = existing;
  } catch {
    current = 0;
  }
  const next = current + 1;
  await store.setJSON(dateKey, next);

  const progressive = String(next).padStart(3, '0');
  const suffix = buildSuffix(items) || 'X';

  return `TRPLRG-${mm}${dd}${yy}-${progressive}-${suffix}`;
}

module.exports = { generateOrderId };
