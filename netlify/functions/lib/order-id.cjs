// Genera un Order ID tipo TRPLRG-082126-001-F2T
// Formato: TRPLRG-MMGGAA-NNN-SUFFISSO
//  - MMGGAA: mese/giorno/anno(2 cifre), fuso orario Europe/Rome
//  - NNN: numero progressivo del giorno (riparte da 001 ogni giorno), salvato su Netlify Blobs
//  - SUFFISSO: per ogni tipo di prodotto presente nell'ordine, in ordine alfabetico (C, F, T, V):
//    se quantità 1 -> solo la lettera (es. "F"), se quantità >1 -> numero+lettera (es. "2T")

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const LETTERS = {
  'xl-cd': 'C',
  'xl-felpa': 'F',
  'xl-maglietta': 'T',
  'xl-vinile': 'V',
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

  // Fallback robusto: usato quando Blobs è irraggiungibile OPPURE quando,
  // dopo 3 tentativi, non siamo mai riusciti a CONFERMARE che il valore
  // scritto fosse davvero il nostro (scritture concorrenti che si accavallano
  // in continuazione). In quel caso NON dobbiamo comunque usare `next`: è un
  // numero che potremmo non aver mai davvero "vinto", quindi rischia di
  // duplicare il progressivo di un altro ordine dello stesso giorno.
  // Il vecchio fallback Date.now().slice(-3) aveva solo 3 cifre decimali
  // (1000 valori possibili, si ripete più volte al giorno): qui usiamo
  // timestamp in base36 + byte casuali crittografici, entropia molto più alta.
  function robustFallbackProgressive() {
    const t = Date.now().toString(36).toUpperCase().slice(-4);
    const r = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `${t}${r}`;
  }

  let progressive = '000';
  try {
    const store = getOrderCountersStore();
    // Mitigazione race condition: se due acquisti arrivano nello stesso istante,
    // rileggiamo il valore fresco ad ogni tentativo invece di fidarci di una
    // lettura fatta prima. Non è un lock atomico vero (richiederebbe un database
    // con transazioni), ma per pochi ordini/giorno riduce il rischio di ID
    // duplicati quasi a zero. In ogni caso un eventuale ID duplicato è solo
    // un problema di etichetta leggibile: non influisce sull'addebito reale.
    let next = 1;
    let verified = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      let current = 0;
      try {
        const existing = await store.get(dateKey, { type: 'json' });
        if (typeof existing === 'number') current = existing;
      } catch {
        current = 0;
      }
      next = current + 1;
      await store.setJSON(dateKey, next);

      // Verifica che nessuno abbia scritto sopra di noi nel frattempo.
      // Se il valore letto ora è quello che abbiamo appena scritto, ci fermiamo
      // qui — altrimenti c'è stata una scrittura concorrente e riproviamo.
      try {
        const verify = await store.get(dateKey, { type: 'json' });
        if (verify === next) {
          verified = true;
          break;
        }
      } catch {
        // Lettura di verifica fallita: non possiamo confermare che `next` sia
        // davvero nostro, quindi NON usciamo dichiarando successo — lasciamo
        // che il ciclo esaurisca i tentativi (o riprovi) come un normale conflitto.
      }

      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 30 + Math.floor(Math.random() * 50)));
      }
    }
    // Dopo 3 tentativi senza una verifica confermata, `next` non è affidabile:
    // usiamo il fallback robusto invece di rischiare un progressivo duplicato.
    progressive = verified ? String(next).padStart(3, '0') : robustFallbackProgressive();
  } catch (err) {
    // Logghiamo l'errore vero nei log della function Netlify (Netlify UI -> Functions -> logs)
    // così la prossima volta si vede subito perché Blobs non ha scritto nulla,
    // invece di scoprirlo solo dal fatto che lo store risulta vuoto.
    console.error('Netlify Blobs error in generateOrderId:', err);
    progressive = robustFallbackProgressive();
  }

  const suffix = buildSuffix(items) || 'X';

  return `TRPLRG-${mm}${dd}${yy}-${progressive}-${suffix}`;
}

module.exports = { generateOrderId };
