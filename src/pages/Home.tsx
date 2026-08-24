import { products, homepageOrder } from '../data/products';
import ProductCard from '../components/ProductCard';
import { usePageMeta } from '../hooks/usePageMeta';
import './Home.css';

export default function Home() {
  usePageMeta({
    title: '',
    description: "L'album di debutto di XL. Vinile, CD e merch ufficiale.",
    image: 'https://trplrg.com/brand/logo.png',
  });

  const featured = homepageOrder
    .map(h => products.find(p => p.handle === h))
    .filter(Boolean) as typeof products;

  return (
    <div className="home">
      <div className="home__grid container">
        {featured.map((p, idx) => (
          <ProductCard key={p.handle} product={p} priority={idx < 4} />
        ))}
      </div>

    </div>
  );
}
