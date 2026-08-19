import { products, homepageOrder } from '../data/products';
import ProductCard from '../components/ProductCard';
import './Home.css';

export default function Home() {
  const featured = homepageOrder
    .map(h => products.find(p => p.handle === h))
    .filter(Boolean) as typeof products;

  return (
    <div className="home">
      <div className="home__grid container">
        {featured.map(p => (
          <ProductCard key={p.handle} product={p} />
        ))}
      </div>

    </div>
  );
}
