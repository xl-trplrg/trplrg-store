import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Senza questo, essendo un sito a pagina singola (SPA), il browser non riporta
// mai lo scroll in cima quando cambi pagina — resta dove ti trovavi prima.
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname === '/') {
      // In home mostriamo sempre l'header completo con il logo grande
      window.scrollTo(0, 0);
      return;
    }
    // Nelle altre pagine saltiamo l'header decorativo e andiamo dritti all'inizio del contenuto
    const main = document.querySelector('main');
    if (main) {
      const y = main.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, y);
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}
