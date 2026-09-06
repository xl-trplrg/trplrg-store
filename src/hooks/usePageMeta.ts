import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description?: string;
  image?: string;
  // Se omesso, la pagina resta indicizzabile normalmente ('index, follow').
  // Usare 'noindex, follow' per le pagine che Google deve poter leggere e
  // usare come contesto, ma senza mostrarle come risultato di ricerca a sé
  // stante (es. /chi-siamo, per evitare che competa con la home).
  robots?: string;
}

function setMetaTag(attr: 'name' | 'property', key: string, value: string) {
  let tag = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', value);
}

// Aggiorna <title> e i meta tag (description + Open Graph) per la pagina
// corrente. Senza questo, ogni pagina del sito (home, ogni prodotto, ecc.)
// mostrerebbe sempre lo stesso titolo/anteprima di index.html — male sia per
// Google sia per le condivisioni su WhatsApp/Instagram di un prodotto specifico.
export function usePageMeta({ title, description, image, robots }: PageMeta) {
  useEffect(() => {
    const fullTitle = title ? `${title} — Troppo Largo` : 'Troppo Largo';
    document.title = fullTitle;
    if (description) {
      setMetaTag('name', 'description', description);
      setMetaTag('property', 'og:description', description);
    }
    setMetaTag('property', 'og:title', fullTitle);
    if (image) {
      setMetaTag('property', 'og:image', image);
    }
    // Impostato SEMPRE esplicitamente (mai in modo condizionale): essendo una
    // SPA, il tag <meta name="robots"> creato per una pagina resterebbe nel
    // <head> anche navigando altrove se non lo sovrascrivessimo qui ad ogni
    // cambio pagina. Default 'index, follow' per tutte le pagine normali.
    setMetaTag('name', 'robots', robots ?? 'index, follow');
    // Nessun cleanup: alla pagina successiva questo stesso hook sovrascrive
    // di nuovo i valori, quindi non serve resettare nulla qui.
  }, [title, description, image, robots]);
}
