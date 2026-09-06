export interface Size {
  label: string;
  available: boolean;
}

export interface Product {
  handle: string;
  title: string;
  price: number;
  type: string;
  available: boolean;
  img: string;
  img2?: string;
  img3?: string;
  // Alt text descrittivo per ciascuna immagine — usato al posto del solo
  // titolo prodotto per aiutare l'indicizzazione immagini di Google (carosello
  // Google Immagini/Shopping) e l'accessibilità screen reader.
  imgAlt: string;
  img2Alt?: string;
  img3Alt?: string;
  description: string;
  tag?: string;
  sizes?: Size[];
  // Prodotto digitale gratuito: niente carrello/spedizione/pagamento,
  // il bottone scarica direttamente il file indicato in downloadUrl.
  digital?: boolean;
  downloadUrl?: string;
  // Se true, questo prodotto non fa scattare il costo di spedizione quando è
  // l'unico tipo di articolo nel carrello (usato per il prodotto di test checkout).
  noShipping?: boolean;
  // Forza un costo di spedizione fisso invece di quello calcolato per paese,
  // usato SOLO dal secondo prodotto di test per tenere basso il costo del
  // test PayPal (che altrimenti userebbe la spedizione Italia normale, 6€+).
  testShippingOverride?: number;
}

// SEGNAPOSTO — sostituisci img/img2/description con i tuoi dati reali quando li mandi.
// Le taglie: metti "available: false" su una taglia per segnarla esaurita sul sito.
export const products: Product[] = [
  {
    handle: 'xl-vinile',
    title: 'TROPPO LARGO Vinyl',
    price: 30,
    type: 'Vinili',
    available: true,
    img: '/products/vinile.jpg',
    img2: '/products/vinile-2.jpg',
    img3: '/products/vinile-3.jpg',
    imgAlt: 'Copertina del vinile "Troppo Largo" di XL, album di debutto hip hop boom bap autoprodotto',
    img2Alt: 'Retro del vinile "Troppo Largo" di XL con tracklist stampata',
    img3Alt: 'Dettaglio ravvicinato del vinile "Troppo Largo", edizione fisica dell\'album di XL',
    description: '"TROPPO LARGO" — il primo album da solista di XL, interamente autoprodotto.\n\nTracklist:\n1. Troppo Largo\n2. Polemiche\n3. Schh\n4. Sacra\n5. Il Motivo\n6. Ridi Ridi\n7. Il Vizio\n8. La Spinta\n9. Segno\n10. Il Segreto\n11. Detto Fatto\n12. Via Vai\n13. Chi Lo Fa\n14. Rap Chanel\n\nL\'anteprima del vinile è un mock-up digitale, il prodotto finale potrebbe differire da questa anteprima.',
  },
  {
    handle: 'xl-cd',
    title: 'TROPPO LARGO CD Edition',
    price: 20,
    type: 'CD',
    available: true,
    img: '/products/cd.jpg',
    imgAlt: 'Copertina del CD "Troppo Largo" di XL, edizione fisica dell\'album di debutto hip hop',
    description: '"TROPPO LARGO" — il primo album da solista di XL, interamente autoprodotto.\n\nTracklist:\n1. Rap Chanel\n2. Troppo Largo\n3. Il Motivo\n4. Sacra\n5. Schh\n6. Il Segreto\n7. Polemiche\n8. Ridi Ridi\n9. La Spinta\n10. Il Vizio\n11. Segno\n12. Il Contrario\n13. Detto Fatto\n14. Via Vai\n15. Chi Lo Fa\n\nL\'anteprima del CD è un mock-up digitale, il prodotto finale potrebbe differire da questa anteprima.',
  },
  {
    handle: 'xl-maglietta',
    title: 'YATP T-Shirt Bianca',
    price: 25,
    type: 'T-Shirt',
    available: true,
    img: '/products/tshirt-front.jpg',
    img2: '/products/tshirt-back.jpg',
    imgAlt: 'T-shirt bianca YATP con stampa serigrafica fronte, merch ufficiale di XL',
    img2Alt: 'Retro della t-shirt bianca YATP con stampa serigrafica, merch ufficiale di XL',
    description: 'Stampa serigrafica fronte, retro e interno collo. Struttura con cuciture laterali. Colore bianco. 100% cotone organico, 180g/m². Unisex. Vestibilità oversize — se in dubbio controlla la tabella taglie tra le foto.',
    sizes: [
      { label: 'XL', available: true },
      { label: '2XL', available: true },
      { label: '3XL', available: true },
    ],
  },
  {
    handle: 'xl-felpa',
    title: 'TROPPO LARGO - Hoodie',
    price: 40,
    type: 'Felpe',
    available: true,
    img: '/products/hoodie-front.jpg',
    img2: '/products/hoodie-back.jpg',
    imgAlt: 'Felpa nera "Troppo Largo" con stampa fronte, merch ufficiale dell\'album di XL',
    img2Alt: 'Retro della felpa nera "Troppo Largo" con stampa, merch ufficiale di XL',
    description: 'Stampa fronte, retro e interno collo. Colore nero. 80% cotone, 20% poliestere, 280 g/m². Unisex.',
    sizes: [
      { label: 'XL', available: true },
      { label: '2XL', available: true },
      { label: '3XL', available: true },
    ],
  },
];

export const homepageOrder = [
  'xl-vinile',
  'xl-cd',
  'xl-maglietta',
  'xl-felpa',
];

export function getProduct(handle: string): Product | undefined {
  return products.find(p => p.handle === handle);
}

export function formatPrice(price: number): string {
  if (price === 0) return 'Gratis';
  return `€${price.toFixed(2).replace('.', ',')}`;
}

export const categories = ['All', 'Vinili', 'CD', 'T-Shirt', 'Felpe'];
