import { useState } from 'react';
import './Account.css';

export default function Account() {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="account container">
      <h1 className="account__title">{mode === 'login' ? 'Accedi' : 'Registrati'}</h1>
      <form className="account__form" onSubmit={e => e.preventDefault()}>
        {mode === 'register' && (
          <input type="text" placeholder="Nome" className="account__input" />
        )}
        <input type="email" placeholder="Email" className="account__input" required />
        <input type="password" placeholder="Password" className="account__input" required />
        <button type="submit" className="account__submit">
          {mode === 'login' ? 'Accedi' : 'Crea account'}
        </button>
      </form>
      <p className="account__toggle">
        {mode === 'login' ? 'Non hai un account?' : 'Hai già un account?'}
        <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Registrati' : 'Accedi'}
        </button>
      </p>
    </div>
  );
}
