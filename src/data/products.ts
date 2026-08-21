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
  description: string;
  tag?: string;
  sizes?: Size[];
  // Prodotto digitale gratuito: niente carrello/spedizione/pagamento,
  // il bottone scarica direttamente il file indicato in downloadUrl.
  digital?: boolean;
  downloadUrl?: string;
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
    description: '"TROPPO LARGO" — il primo album da solista di XL, interamente autoprodotto.\n\nTracklist:\n1. Rap Chanel\n2. Troppo Largo\n3. Il Motivo\n4. Sacra\n5. Schh\n6. Il Segreto\n7. Polemiche\n8. Ridi Ridi\n9. La Spinta\n10. Il Vizio\n11. Segno\n12. Il Contrario\n13. Detto Fatto\n14. Via Vai\n15. Chi Lo Fa\n\nL\'anteprima del vinile è un mock-up digitale, il prodotto finale potrebbe differire da questa anteprima.',
  },
  {
    handle: 'xl-cd',
    title: 'TROPPO LARGO CD Edition',
    price: 20,
    type: 'CD',
    available: true,
    img: '/products/cd.jpg',
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
    description: 'Stampa fronte, retro e interno collo. Colore nero. 80% cotone, 20% poliestere, 280 g/m². Unisex.',
    sizes: [
      { label: 'XL', available: true },
      { label: '2XL', available: true },
      { label: '3XL', available: true },
    ],
  },
  {
    handle: 'xl-album-digitale',
    title: 'Album Digitale',
    price: 0,
    type: 'Digitale',
    available: true,
    img: '/products/album-digitale.jpg',
    description: 'Versione Digitale Scaricabile',
    digital: true,
    downloadUrl: '/downloads/XL-TRPLRG-2026.zip',
  },
];

export const homepageOrder = [
  'xl-vinile',
  'xl-cd',
  'xl-maglietta',
  'xl-felpa',
  'xl-album-digitale',
];

export function getProduct(handle: string): Product | undefined {
  return products.find(p => p.handle === handle);
}

export function formatPrice(price: number): string {
  if (price === 0) return 'Gratis';
  return `€${price.toFixed(2).replace('.', ',')}`;
}

export const categories = ['All', 'Vinili', 'CD', 'T-Shirt', 'Felpe', 'Digitale'];
