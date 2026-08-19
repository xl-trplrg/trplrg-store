import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProduct, products, formatPrice } from '../data/products';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
import PayPalButton from '../components/PayPalButton';
import { PlusIcon, MinusIcon } from '../components/Icons';
import './ProductDetail.css';

export default function ProductDetail() {
  const { handle } = useParams();
  const product = handle ? getProduct(handle) : undefined;
  const { add } = useCart();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const [showQuickPaypal, setShowQuickPaypal] = useState(false);

  if (!product) {
    return (
      <div className="product-detail__not-found container">
        <h1>Pagina non trovata</h1>
        <Link to="/catalog" className="product-detail__back">Torna al catalogo</Link>
      </div>
    );
  }

  const images = [product.img, product.img2, product.img3].filter(Boolean);
  const sameType = products.filter(p => p.type === product.type && p.handle !== product.handle);
  const related = (sameType.length > 0 ? sameType : products.filter(p => p.handle !== product.handle)).slice(0, 4);

  return (
    <div className="product-detail">
      <div className="product-detail__main container">
        <div className="product-detail__gallery">
          <div className="product-detail__main-img">
            <img src={images[activeImg]} alt={product.title} />
            {!product.available && <span className="product-detail__badge">Esaurito</span>}
          </div>
          {images.length > 1 && (
            <div className="product-detail__thumbs">
              {images.map((img, i) => (
                <button
                  key={i}
                  className={`product-detail__thumb ${i === activeImg ? 'product-detail__thumb--active' : ''}`}
                  onClick={() => setActiveImg(i)}
                >
                  <img src={img} alt={`${product.title} ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-detail__info">
          <h1 className="product-detail__title">{product.title}</h1>
          <p className="product-detail__price">{formatPrice(product.price)}</p>
          <p className="product-detail__desc">{product.description}</p>

          {product.sizes && (
            <div className="product-detail__sizes">
              <p className="product-detail__sizes-label">Taglia</p>
              <div className="product-detail__sizes-options">
                {product.sizes.map(s => (
                  <button
                    key={s.label}
                    className={`product-detail__size ${selectedSize === s.label ? 'product-detail__size--active' : ''} ${!s.available ? 'product-detail__size--sold-out' : ''}`}
                    disabled={!s.available}
                    onClick={() => { setSelectedSize(s.label); setSizeError(false); }}
                  >
                    {s.label}
                    {!s.available && <span className="product-detail__size-line" />}
                  </button>
                ))}
              </div>
              {sizeError && <p className="product-detail__size-error">Seleziona una taglia prima di continuare.</p>}
            </div>
          )}

          <div className="product-detail__buy">
            <div className="product-detail__qty">
              <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease"><MinusIcon /></button>
              <span>{qty}</span>
              <button onClick={() => setQty(qty + 1)} aria-label="Increase"><PlusIcon /></button>
            </div>
            <button
              className={`product-detail__add ${!product.available ? 'product-detail__add--disabled' : ''}`}
              disabled={!product.available}
              onClick={() => {
                if (product.sizes && !selectedSize) {
                  setSizeError(true);
                  return;
                }
                add(product, qty, selectedSize ?? undefined);
              }}
            >
              {product.available ? 'Aggiungi al carrello' : 'Esaurito'}
            </button>
          </div>

          {product.available && (
            <div className="product-detail__quick-pay">
              {showQuickPaypal ? (
                <PayPalButton
                  items={[{ product, quantity: qty, size: selectedSize ?? undefined }]}
                  total={product.price * qty}
                  onSuccess={() => navigate('/')}
                />
              ) : (
                <button
                  className="product-detail__paypal-cta"
                  onClick={() => {
                    if (product.sizes && !selectedSize) {
                      setSizeError(true);
                      return;
                    }
                    setShowQuickPaypal(true);
                  }}
                >
                  Paga con <span className="product-detail__paypal-logo">PayPal</span>
                </button>
              )}
              <button
                className="product-detail__more-options"
                onClick={() => {
                  if (product.sizes && !selectedSize) {
                    setSizeError(true);
                    return;
                  }
                  add(product, qty, selectedSize ?? undefined);
                  navigate('/cart');
                }}
              >
                Altre opzioni di pagamento
              </button>
            </div>
          )}

          <div className="product-detail__meta">
            <p><strong>Tipo:</strong> {product.type || 'N/D'}</p>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="product-detail__related container">
          <h2 className="product-detail__related-title">Prodotti correlati</h2>
          <div className="product-detail__related-grid">
            {related.map(p => (
              <ProductCard key={p.handle} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
