import { useSearchParams, Link } from 'react-router-dom';
import { products } from '../data/products';
import ProductCard from '../components/ProductCard';
import './Search.css';

export default function Search() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const query = q.toLowerCase();

  const results = query
    ? products.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.type.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      )
    : [];

  return (
    <div className="search-page container">
      <h1 className="search-page__title">
        {q ? `Risultati per "${q}"` : 'Cerca'}
      </h1>

      {q && (
        <p className="search-page__count">
          {results.length} {results.length === 1 ? 'prodotto trovato' : 'prodotti trovati'}
        </p>
      )}

      {results.length > 0 ? (
        <div className="search-page__grid">
          {results.map(p => (
            <ProductCard key={p.handle} product={p} />
          ))}
        </div>
      ) : q ? (
        <div className="search-page__empty">
          <p>Nessun risultato. Prova con un altro termine.</p>
          <Link to="/catalog" className="search-page__link">Vai al catalogo</Link>
        </div>
      ) : (
        <p className="search-page__hint">Digita qualcosa nella barra di ricerca.</p>
      )}
    </div>
  );
}
