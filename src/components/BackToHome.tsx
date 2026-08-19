import { Link, useLocation } from 'react-router-dom';
import { ArrowLeftIcon } from './Icons';
import './BackToHome.css';

// Mostrato in fondo a ogni pagina (tranne la home stessa), prima del footer.
export default function BackToHome() {
  const { pathname } = useLocation();
  if (pathname === '/') return null;

  return (
    <div className="back-to-home">
      <Link to="/" className="back-to-home__link">
        <ArrowLeftIcon size={16} />
        Torna alla Home
      </Link>
    </div>
  );
}
