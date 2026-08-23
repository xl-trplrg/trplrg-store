import { useEffect, useState } from 'react';
import { useLocation, useSearchParams, Link } from 'react-router-dom';
import { formatPrice } from '../data/products';
import './OrderConfirmation.css';

interface OrderItem {
  name: string;
  quantity: number;
  amount: number;
  image?: string | null;
  downloadUrl?: string | null;
}

interface Buyer {
  name: string;
  address: string;
}

interface OrderData {
  orderId: string | null;
  items: OrderItem[];
  total: number;
  buyer?: Buyer | null;
}

export default function OrderConfirmation() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const orderIdParam = searchParams.get('order_id');
  const stateData = (location.state as OrderData | undefined) ?? null;

  const [order, setOrder] = useState<OrderData | null>(stateData);
  const [loading, setLoading] = useState(!stateData && !!(sessionId || orderIdParam));
  const [error, setError] = useState('');

  useEffect(() => {
    if (stateData) return;
    if (sessionId) {
      setLoading(true);
      fetch(`/.netlify/functions/get-order-details?session_id=${encodeURIComponent(sessionId)}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            setError(data.error);
          } else {
            setOrder(data);
          }
        })
        .catch(() => setError('Impossibile recuperare i dettagli dell\'ordine.'))
        .finally(() => setLoading(false));
      return;
    }
    if (orderIdParam) {
      // Caso PayPal/Google Pay dopo un refresh: non c'è un session_id Stripe,
      // recuperiamo la copia salvata al momento del pagamento.
      setLoading(true);
      fetch(`/.netlify/functions/get-order-by-id?order_id=${encodeURIComponent(orderIdParam)}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            setError(data.error);
          } else {
            setOrder(data);
          }
        })
        .catch(() => setError('Impossibile recuperare i dettagli dell\'ordine.'))
        .finally(() => setLoading(false));
    }
  }, [sessionId, orderIdParam, stateData]);

  if (loading) {
    return (
      <div className="order-confirmation container">
        <p className="order-confirmation__loading">Verifica dell'ordine in corso...</p>
      </div>
    );
  }

  if (!order || error) {
    return (
      <div className="order-confirmation container">
        <div className="order-confirmation__card">
          <h1 className="order-confirmation__title">Nessun ordine da mostrare</h1>
          <p className="order-confirmation__subtitle">
            Se hai appena completato un acquisto e vedi questo messaggio, controlla la tua email
            di conferma o contattaci.
          </p>
          <Link to="/" className="order-confirmation__button">Torna alla home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="order-confirmation container">
      <div className="order-confirmation__card">
        <div className="order-confirmation__check">
          <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
            <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 className="order-confirmation__title">Grazie!</h1>
        <p className="order-confirmation__subtitle">Il tuo ordine è confermato</p>

        {order.orderId && (
          <p className="order-confirmation__order-id">
            Ordine: <strong>{order.orderId}</strong>
          </p>
        )}

        {order.buyer?.name && (
          <div className="order-confirmation__buyer">
            <p className="order-confirmation__buyer-name">{order.buyer.name}</p>
            {order.buyer.address && (
              <p className="order-confirmation__buyer-address">{order.buyer.address}</p>
            )}
          </div>
        )}

        <div className="order-confirmation__items">
          {order.items.map((item, idx) => (
            <div key={`${item.name}-${idx}`} className="order-confirmation__item">
              {item.image && (
                <img src={item.image} alt={item.name} className="order-confirmation__item-img" />
              )}
              <div className="order-confirmation__item-info">
                <p className="order-confirmation__item-name">{item.name}</p>
                <p className="order-confirmation__item-qty">Qtà: {item.quantity}</p>
                {item.downloadUrl && (
                  <a href={item.downloadUrl} download className="order-confirmation__download">
                    Scarica di nuovo
                  </a>
                )}
              </div>
              <span className="order-confirmation__item-amount">{formatPrice(item.amount)}</span>
            </div>
          ))}

          <div className="order-confirmation__total">
            <span>Totale</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>

        <Link to="/" className="order-confirmation__button">Continua lo shopping</Link>
      </div>
    </div>
  );
}
