import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../data/products';
import { shippingCountries, getShippingCost } from '../data/shipping';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon, MinusIcon, TrashIcon } from '../components/Icons';
import PayPalButton from '../components/PayPalButton';
import GooglePayButton from '../components/GooglePayButton';
import './CartPage.css';

export default function CartPage() {
  const { items, setQty, remove, total, clear } = useCart();
  const [country, setCountry] = useState('IT');
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const allExemptFromShipping = items.length > 0 && items.every(i => i.product.noShipping || i.product.digital);
  const testShippingOverride = items.length > 0 && items.every(i => typeof i.product.testShippingOverride === 'number')
    ? items[0].product.testShippingOverride
    : undefined;
  const shippingCost = allExemptFromShipping ? 0 : (testShippingOverride ?? getShippingCost(country));
  const grandTotal = total + shippingCost;

  const handleWalletSuccess = (orderId: string, buyer?: { name: string; address: string }) => {
    navigate(`/ordine-confermato?order_id=${encodeURIComponent(orderId)}`, {
      state: {
        orderId,
        items: items.map(i => ({
          name: i.size ? `${i.product.title} — Taglia ${i.size}` : i.product.title,
          quantity: i.quantity,
          amount: i.product.price * i.quantity,
          image: i.product.img,
        })),
        total: grandTotal,
        buyer,
      },
    });
    clear();
  };

  const handleStripeCheckout = async () => {
    setError('');
    setLoadingStripe(true);
    try {
      const res = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ handle: i.product.handle, quantity: i.quantity, size: i.size })),
          country,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Errore durante il checkout.');
      }
    } catch {
      setError('Impossibile contattare il pagamento. Riprova.');
    } finally {
      setLoadingStripe(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="cart-page container">
        <h1 className="cart-page__title">Carrello</h1>
        <div className="cart-page__empty">
          <p>Il tuo carrello è vuoto.</p>
          <Link to="/" className="cart-page__shop-link">Continua lo shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page container">
      <h1 className="cart-page__title">Carrello</h1>
      <div className="cart-page__layout">
        <div className="cart-page__items">
          {items.map(item => (
            <div key={`${item.product.handle}__${item.size ?? ''}`} className="cart-page__item">
              <Link to={`/products/${item.product.handle}`} className="cart-page__item-img">
                <img src={item.product.img} alt={item.product.title} />
              </Link>
              <div className="cart-page__item-info">
                <Link to={`/products/${item.product.handle}`} className="cart-page__item-title">
                  {item.product.title}
                </Link>
                {item.size && <p className="cart-page__item-size">Taglia: {item.size}</p>}
                <p className="cart-page__item-price">{formatPrice(item.product.price)}</p>
              </div>
              <div className="cart-page__item-controls">
                <div className="cart-page__qty">
                  <button onClick={() => setQty(item.product.handle, item.quantity - 1, item.size)} aria-label="Decrease"><MinusIcon /></button>
                  <span>{item.quantity}</span>
                  <button onClick={() => setQty(item.product.handle, item.quantity + 1, item.size)} aria-label="Increase"><PlusIcon /></button>
                </div>
                <button onClick={() => remove(item.product.handle, item.size)} className="cart-page__remove" aria-label="Remove"><TrashIcon /></button>
              </div>
              <p className="cart-page__item-subtotal">{formatPrice(item.product.price * item.quantity)}</p>
            </div>
          ))}
          <button onClick={clear} className="cart-page__clear">Svuota carrello</button>
        </div>

        <div className="cart-page__summary">
          <h2 className="cart-page__summary-title">Riepilogo</h2>
          <div className="cart-page__summary-row">
            <span>Subtotale</span>
            <span>{formatPrice(total)}</span>
          </div>

          {allExemptFromShipping ? (
            <div className="cart-page__summary-row">
              <span>Spedizione</span>
              <span>Gratis</span>
            </div>
          ) : testShippingOverride !== undefined ? (
            <div className="cart-page__summary-row">
              <span>Spedizione</span>
              <span>{formatPrice(testShippingOverride)} (fissa — prodotto test)</span>
            </div>
          ) : (
            <label className="cart-page__summary-row cart-page__shipping-select">
              <span>Spedizione</span>
              <select value={country} onChange={e => setCountry(e.target.value)}>
                {shippingCountries.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.label} (+{c.cost}€)
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="cart-page__summary-total">
            <span>Totale</span>
            <span>{formatPrice(grandTotal)}</span>
          </div>

          {error && <p className="cart-page__error">{error}</p>}

          <button
            className="cart-page__checkout"
            onClick={handleStripeCheckout}
            disabled={loadingStripe}
          >
            {loadingStripe ? 'Attendere...' : 'Check-out'}
          </button>

          <div className="cart-page__wallets-wrap">
            <PayPalButton items={items} total={grandTotal} shippingCost={shippingCost} onSuccess={handleWalletSuccess} />
            <GooglePayButton items={items} total={grandTotal} country={country} onSuccess={handleWalletSuccess} />
          </div>

          <Link to="/" className="cart-page__continue">Continua lo shopping</Link>
        </div>
      </div>
    </div>
  );
}
