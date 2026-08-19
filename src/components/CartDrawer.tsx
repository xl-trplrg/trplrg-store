import { useCart } from '../context/CartContext';
import { formatPrice } from '../data/products';
import { CloseIcon, PlusIcon, MinusIcon, TrashIcon } from './Icons';
import { Link } from 'react-router-dom';
import './CartDrawer.css';

export default function CartDrawer() {
  const { items, isOpen, closeCart, setQty, remove, total } = useCart();

  return (
    <>
      <div className={`cart-overlay ${isOpen ? 'cart-overlay--open' : ''}`} onClick={closeCart} />
      <aside className={`cart-drawer ${isOpen ? 'cart-drawer--open' : ''}`}>
        <div className="cart-drawer__header">
          <h2 className="cart-drawer__title">Carrello</h2>
          <button onClick={closeCart} aria-label="Close"><CloseIcon /></button>
        </div>

        {items.length === 0 ? (
          <div className="cart-drawer__empty">
            <p>Il tuo carrello è vuoto.</p>
            <Link to="/" onClick={closeCart} className="cart-drawer__shop">Torna allo shop</Link>
          </div>
        ) : (
          <>
            <div className="cart-drawer__items">
              {items.map(item => (
                <div key={`${item.product.handle}__${item.size ?? ''}`} className="cart-item">
                  <Link to={`/products/${item.product.handle}`} onClick={closeCart} className="cart-item__img">
                    <img src={item.product.img} alt={item.product.title} />
                  </Link>
                  <div className="cart-item__info">
                    <Link to={`/products/${item.product.handle}`} onClick={closeCart} className="cart-item__title">
                      {item.product.title}
                    </Link>
                    {item.size && <p className="cart-item__size">Taglia: {item.size}</p>}
                    <p className="cart-item__price">{formatPrice(item.product.price)}</p>
                    <div className="cart-item__controls">
                      <div className="cart-item__qty">
                        <button onClick={() => setQty(item.product.handle, item.quantity - 1, item.size)} aria-label="Decrease"><MinusIcon /></button>
                        <span>{item.quantity}</span>
                        <button onClick={() => setQty(item.product.handle, item.quantity + 1, item.size)} aria-label="Increase"><PlusIcon /></button>
                      </div>
                      <button onClick={() => remove(item.product.handle, item.size)} className="cart-item__remove" aria-label="Remove"><TrashIcon /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-drawer__footer">
              <div className="cart-drawer__total">
                <span>Totale</span>
                <span>{formatPrice(total)}</span>
              </div>
              <Link to="/cart" onClick={closeCart} className="cart-drawer__checkout">Vai al carrello</Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
