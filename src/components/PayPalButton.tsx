import { useEffect, useRef } from 'react';
import type { CartItem } from '../context/CartContext';

declare global {
  interface Window {
    paypal?: any;
  }
}

interface Buyer {
  name: string;
  address: string;
}

interface Props {
  items: CartItem[];
  total: number;
  shippingCost?: number;
  country?: string;
  onSuccess: (orderId: string, accessToken: string, buyer?: Buyer) => void;
}

// SEGNAPOSTO: il Client ID PayPal è un dato PUBBLICO (non un segreto), va bene metterlo nel
// file .env come VITE_PAYPAL_CLIENT_ID. Lo trovi su developer.paypal.com -> My Apps & Credentials
// (usa "Live" quando sei pronto a incassare davvero, "Sandbox" per fare prove).
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'YOUR_PAYPAL_CLIENT_ID';

export default function PayPalButton({ items, total, shippingCost = 0, country, onSuccess }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || items.length === 0) return;

    const renderButtons = () => {
      if (!window.paypal || !containerRef.current) return;

      // Aspettiamo che il browser abbia finito di calcolare il layout (flexbox)
      // prima di far disegnare a PayPal il bottone, altrimenti misura una larghezza
      // sbagliata e il logo finisce decentrato o tagliato.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!containerRef.current) return;
          containerRef.current.innerHTML = '';

          const cartItems = items.map((i) => ({
            handle: i.product.handle,
            quantity: i.quantity,
            size: i.size,
          }));

          window.paypal
            .Buttons({
              style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', height: 45 },
              // L'ordine ora viene creato dal server: calcola il totale dal catalogo
              // vero (lib/prices.cjs + lib/shipping.cjs), così non può più essere
              // alterato dal browser prima di partire verso PayPal.
              createOrder: async () => {
                const res = await fetch('/.netlify/functions/paypal-create-order', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ items: cartItems, country }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(err.error || 'Impossibile creare l\'ordine PayPal');
                }
                const data = await res.json();
                return data.orderID;
              },
              // L'incasso ora avviene sul server (mai più actions.order.capture()
              // nel browser): il browser comunica solo che l'utente ha approvato.
              onApprove: async (data: { orderID: string }) => {
                const res = await fetch('/.netlify/functions/paypal-capture-order', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderID: data.orderID, items: cartItems }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(err.error || 'Impossibile completare il pagamento PayPal');
                }
                const result = await res.json();
                onSuccess(result.orderId, result.accessToken, result.buyer ?? undefined);
              },
            })
            .render(containerRef.current);
        });
      });
    };

    if (window.paypal) {
      renderButtons();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-paypal-sdk]');
      if (existing) {
        // Lo script è già in caricamento da un mount precedente del componente:
        // aspettiamo che finisca invece di aggiungerne un altro identico.
        existing.addEventListener('load', renderButtons, { once: true });
      } else {
        const script = document.createElement('script');
        script.dataset.paypalSdk = 'true';
        script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=EUR&disable-funding=card,credit,mybank,sepa,sofort,venmo,paylater`;
        script.onload = renderButtons;
        document.body.appendChild(script);
      }
    }
  }, [items, total, shippingCost, country, onSuccess]);

  return <div ref={containerRef} className="paypal-button-container" />;
}
