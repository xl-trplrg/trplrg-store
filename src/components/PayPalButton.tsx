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
  onSuccess: (orderId: string, buyer?: Buyer) => void;
}

// SEGNAPOSTO: il Client ID PayPal è un dato PUBBLICO (non un segreto), va bene metterlo nel
// file .env come VITE_PAYPAL_CLIENT_ID. Lo trovi su developer.paypal.com -> My Apps & Credentials
// (usa "Live" quando sei pronto a incassare davvero, "Sandbox" per fare prove).
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'YOUR_PAYPAL_CLIENT_ID';

export default function PayPalButton({ items, total, shippingCost = 0, onSuccess }: Props) {
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

          window.paypal
            .Buttons({
              style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', height: 45 },
              createOrder: (_data: unknown, actions: any) => {
                return actions.order.create({
                  purchase_units: [
                    {
                      amount: {
                        value: total.toFixed(2),
                        currency_code: 'EUR',
                        breakdown: {
                          // PayPal richiede che item_total sia ESATTAMENTE la somma degli
                          // unit_amount degli items sotto — la spedizione va nel suo campo
                          // separato, altrimenti PayPal può rifiutare l'ordine.
                          item_total: { value: (total - shippingCost).toFixed(2), currency_code: 'EUR' },
                          shipping: { value: shippingCost.toFixed(2), currency_code: 'EUR' },
                        },
                      },
                      items: items.map(i => ({
                        name: i.size ? `${i.product.title} — Taglia ${i.size}` : i.product.title,
                        unit_amount: { value: i.product.price.toFixed(2), currency_code: 'EUR' },
                        quantity: String(i.quantity),
                      })),
                    },
                  ],
                });
              },
              onApprove: async (_data: unknown, actions: any) => {
                const details = await actions.order.capture();
                let orderId = '';
                try {
                  const res = await fetch('/.netlify/functions/generate-order-id', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      items: items.map(i => ({ handle: i.product.handle, quantity: i.quantity })),
                    }),
                  });
                  const data = await res.json();
                  orderId = data.orderId || '';
                } catch {
                  orderId = '';
                }

                let buyer: Buyer | undefined;
                try {
                  const shipping = details?.purchase_units?.[0]?.shipping;
                  const payerName = details?.payer?.name;
                  const name = shipping?.name?.full_name
                    || (payerName ? `${payerName.given_name || ''} ${payerName.surname || ''}`.trim() : '');
                  const a = shipping?.address;
                  if (name || a) {
                    buyer = {
                      name: name || '',
                      address: a
                        ? `${[a.address_line_1, a.address_line_2].filter(Boolean).join(', ')}, ${a.postal_code || ''} ${a.admin_area_2 || ''}${a.admin_area_1 ? ' (' + a.admin_area_1 + ')' : ''} - ${a.country_code || ''}`
                        : '',
                    };
                  }
                } catch {
                  buyer = undefined;
                }

                onSuccess(orderId, buyer);
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
  }, [items, total, onSuccess]);

  return <div ref={containerRef} className="paypal-button-container" />;
}
