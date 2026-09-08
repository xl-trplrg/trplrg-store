import { BrowserRouter } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import Header from './components/Header';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import CookieBanner from './components/CookieBanner';
import ScrollToTop from './components/ScrollToTop';
import BackToHome from './components/BackToHome';
import AppRoutes from './AppRoutes';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <CartProvider>
        <div className="app">
          <Header />
          <main className="app__main">
            <AppRoutes />
          </main>
          <BackToHome />
          <Footer />
          <CartDrawer />
          <CookieBanner />
        </div>
      </CartProvider>
    </BrowserRouter>
  );
}
