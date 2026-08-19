import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './CookieBanner.css';

const STORAGE_KEY = 'xl-cookie-consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch { /* ignore */ }
  }, []);

  const choose = (value: 'accepted' | 'rejected') => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner">
      <p>
        Usiamo solo cookie tecnici necessari al funzionamento del sito (es. il carrello).
        Leggi l'<Link to="/privacy">informativa privacy</Link>.
      </p>
      <div className="cookie-banner__actions">
        <button onClick={() => choose('rejected')} className="cookie-banner__reject">Rifiuta</button>
        <button onClick={() => choose('accepted')} className="cookie-banner__accept">Accetta</button>
      </div>
    </div>
  );
}
