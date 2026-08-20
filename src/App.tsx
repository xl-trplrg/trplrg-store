import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import Header from './components/Header';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import CookieBanner from './components/CookieBanner';
import ScrollToTop from './components/ScrollToTop';
import BackToHome from './components/BackToHome';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import CartPage from './pages/CartPage';
import Search from './pages/Search';
import Account from './pages/Account';
import PrivacyPolicy from './pages/PrivacyPolicy';
import CookiePolicy from './pages/CookiePolicy';
import ReturnPolicy from './pages/ReturnPolicy';
import Contacts from './pages/Contacts';
import TermsOfService from './pages/TermsOfService';
import NotFound from './pages/NotFound';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <CartProvider>
        <div className="app">
          <Header />
          <main className="app__main">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/products/:handle" element={<ProductDetail />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/search" element={<Search />} />
              <Route path="/account" element={<Account />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/cookie-policy" element={<CookiePolicy />} />
              <Route path="/resi" element={<ReturnPolicy />} />
              <Route path="/recapiti" element={<Contacts />} />
              <Route path="/termini" element={<TermsOfService />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
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
