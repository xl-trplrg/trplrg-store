import { Link } from 'react-router-dom';
import './NotFound.css';

export default function NotFound() {
  return (
    <div className="not-found container">
      <h1 className="not-found__title">Pagina non trovata</h1>
      <p className="not-found__text">La pagina che cerchi non esiste o è stata spostata.</p>
      <Link to="/" className="not-found__link">Torna alla home</Link>
    </div>
  );
}
