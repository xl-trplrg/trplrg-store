import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { SearchIcon, CartIcon, UserIcon, MenuIcon, CloseIcon, InstagramIcon } from './Icons';
import './Header.css';

export default function Header() {
  const { count, openCart } = useCart();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  // Stesso motivo del carrello: senza questo, il menu mobile aperto lascia
  // scorrere la pagina sotto.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery('');
    }
  };

  return (
    <header className="header">
      <div className="header__top container">
        <div className="header__hero-logo">
          <Link to="/">
            <img src="/brand/logo.png" alt="Troppo Largo" />
          </Link>
        </div>

        <div className="header__icon-row">
          <div className="header__left">
            <button className="header__icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search">
              <SearchIcon />
            </button>
            <button className="header__icon-btn header__mobile-only" onClick={() => setMobileOpen(true)} aria-label="Menu">
              <MenuIcon />
            </button>
          </div>

          <div className="header__right">
            <Link to="/account" className="header__icon-btn header__desktop-only" aria-label="Account">
              <UserIcon />
            </Link>
            <button className="header__icon-btn header__cart-btn" onClick={openCart} aria-label="Cart">
              <CartIcon />
              {count > 0 && <span className="header__cart-count">{count}</span>}
            </button>
          </div>
        </div>
      </div>

      <nav className="header__nav container">
        <Link to="/" className="header__nav-link">Home</Link>
        <a href="https://instagram.com/trplrg" target="_blank" rel="noopener noreferrer" className="header__nav-link header__desktop-only">
          <InstagramIcon size={16} />
        </a>
      </nav>

      {searchOpen && (
        <div className="search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="search-overlay__bar" onClick={e => e.stopPropagation()}>
            <form onSubmit={submitSearch} className="search-overlay__form">
              <SearchIcon size={20} />
              <input
                type="text"
                autoFocus
                placeholder="Cerca prodotti..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </form>
            <button onClick={() => setSearchOpen(false)} aria-label="Close">
              <CloseIcon size={20} />
            </button>
          </div>
        </div>
      )}

      {mobileOpen && (
        <div className="mobile-menu" onClick={() => setMobileOpen(false)}>
          <div className="mobile-menu__panel" onClick={e => e.stopPropagation()}>
            <div className="mobile-menu__header">
              <span>Menu</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close"><CloseIcon /></button>
            </div>
            <Link to="/" onClick={() => setMobileOpen(false)}>Home</Link>
            <Link to="/account" onClick={() => setMobileOpen(false)}>Account</Link>
            <a href="https://instagram.com/trplrg" target="_blank" rel="noopener noreferrer">Instagram</a>
          </div>
        </div>
      )}
    </header>
  );
}
