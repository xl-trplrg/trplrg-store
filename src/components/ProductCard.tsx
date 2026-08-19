import { Link } from 'react-router-dom';
import type { Product } from '../data/products';
import { formatPrice } from '../data/products';
import './ProductCard.css';

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link to={`/products/${product.handle}`} className="product-card">
      <div className="product-card__media">
        <img src={product.img} alt={product.title} loading="lazy" />
        {product.img2 && (
          <img src={product.img2} alt={`${product.title} back`} className="product-card__alt" loading="lazy" />
        )}
        {!product.available && <span className="product-card__badge">Esaurito</span>}
        {product.tag && product.available && <span className="product-card__badge product-card__badge--tag">{product.tag}</span>}
      </div>
      <div className="product-card__info">
        <h3 className="product-card__title">{product.title}</h3>
        <p className="product-card__price">{formatPrice(product.price)}</p>
      </div>
    </Link>
  );
}
