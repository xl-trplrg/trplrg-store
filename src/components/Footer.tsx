import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { InstagramIcon, ChevronDownIcon } from './Icons';
import './Footer.css';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { pathname } = useLocation();

  // La conferma "sei iscritto" è valida solo per questa pagina: cambiando pagina si resetta
  useEffect(() => {
    setSubmitted(false);
    setError('');
  }, [pathname]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/.netlify/functions/subscribe-newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) throw new Error();

      setSubmitted(true);
      setEmail('');
    } catch {
      setError('Qualcosa è andato storto. Riprova tra poco.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="footer">
      <div className="footer__inner container">
        <div className="footer__top">
          <div className="footer__newsletter">
            <h2 className="footer__heading">
              {submitted ? 'Sei iscritto alla newsletter.' : 'Iscriviti alla newsletter per ricevere tutti gli aggiornamenti.'}
            </h2>
            {!submitted && (
              <form className="footer__form" onSubmit={submit}>
                <input
                  type="email"
                  placeholder="La tua email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <button type="submit" className="footer__submit" disabled={loading}>
                  {loading ? 'Invio...' : 'Iscriviti'}
                </button>
              </form>
            )}
            {error && <p className="footer__error">{error}</p>}
          </div>

          <div className="footer__social">
            <a href="https://instagram.com/trplrg" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <InstagramIcon size={24} />
            </a>
          </div>
        </div>

        <div className="footer__bottom">
          <div className="footer__links">
            <Link to="/recapiti">Recapiti</Link>
            <Link to="/resi">Politica di restituzione</Link>
            <Link to="/termini">Termini di servizio</Link>
            <Link to="/privacy">Informativa sulla privacy</Link>
          <Link to="/cookie-policy">Cookie Policy</Link>  
          </div>
          <div className="footer__bottom-right">
            <div className="footer__payments">
              <img src="/icons/visa.svg" alt="Visa" className="footer__pay-icon" />
              <img src="/icons/mastercard.svg" alt="Mastercard" className="footer__pay-icon" />
              <img src="/icons/google-pay.svg" alt="Google Pay" className="footer__pay-icon" />
              <img src="/icons/apple-pay.svg" alt="Apple Pay" className="footer__pay-icon" />
              <img src="/icons/paypal.svg" alt="PayPal" className="footer__pay-icon" />
            </div>
            <div className="footer__country">
              <span>Italia | EUR €</span>
              <ChevronDownIcon size={14} />
            </div>
          </div>
        </div>

        <div className="footer__copyright">
          <p>&copy; {new Date().getFullYear()} Troppo Largo. Tutti i diritti riservati.</p>
        </div>
      </div>
    </footer>
  );
}
