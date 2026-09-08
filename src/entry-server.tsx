// Usato SOLO in fase di build (script di prerendering), mai spedito al browser.
// Renderizza ogni pagina del catalogo/sitemap in HTML reale, così Google e gli
// scraper di WhatsApp/Instagram vedono contenuto e meta tag corretti anche
// senza eseguire JavaScript.
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import Header from './components/Header';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import CookieBanner from './components/CookieBanner';
import BackToHome from './components/BackToHome';
import AppRoutes from './AppRoutes';
import { products } from './data/products';
import './App.css';

// Stessa lista della sitemap: home, ogni prodotto, pagine legali.
// Volutamente ESCLUSE: /cart, /account, /search, /ordine-confermato, /chi-siamo
// (pagine di servizio o già reindirizzate, non hanno bisogno di una loro pagina statica).
export const routes: string[] = [
  '/',
  ...products.map((p) => `/products/${p.handle}`),
  '/recapiti',
  '/resi',
  '/termini',
  '/privacy',
  '/cookie-policy',
];

export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <CartProvider>
        <div className="app">
          <Header />
          <main className="app__main">
            <AppRoutes />
          </main>
          <BackToHome />
          <Footer />
          <CartDrawer />
          <CookieBanner />
        </div>
      </CartProvider>
    </StaticRouter>
  );
}

interface RouteMeta {
  title: string;
  description: string;
  image: string;
}

const DEFAULT_META: RouteMeta = {
  title: 'Troppo Largo',
  description: "L'album di debutto di XL. Vinile, CD e merch ufficiale.",
  image: 'https://trplrg.com/brand/logo.png',
};

export function getMeta(url: string): RouteMeta {
  if (url === '/') {
    return {
      title: 'XL — Troppo Largo | Vinile, CD e Merch Ufficiale',
      description: DEFAULT_META.description,
      image: DEFAULT_META.image,
    };
  }

  const match = url.match(/^\/products\/(.+)$/);
  if (match) {
    const product = products.find((p) => p.handle === match[1]);
    if (product) {
      return {
        title: `${product.title} — Troppo Largo`,
        description:
          product.description?.split('\n')[0] || `${product.title}, disponibile su Troppo Largo.`,
        image: product.img ? `https://trplrg.com${product.img}` : DEFAULT_META.image,
      };
    }
  }

  // Pagine legali: stesso titolo/descrizione della home (comportamento
  // identico a quello attuale, dove non impostano nulla di proprio).
  return DEFAULT_META;
}
