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
  // Se true, ignora shippingCost/total fissi: lascia che sia PayPal a chiedere
  // l'indirizzo al cliente dentro al suo popup, e ricalcola la spedizione al volo
  // in base al paese scelto lì (usato dal quick-buy sulla pagina prodotto, dove
  // non c'è nessun menu paese sul sito).
  dynamicShipping?: boolean;
  // Chiamata appena il cliente clicca il bottone PayPal, PRIMA che si apra il
  // popup. Se ritorna false, il popup non si apre — usato per bloccare l'acquisto
  // finché non è stata scelta una taglia, senza bisogno di un secondo bottone finto.
  onValidate?: () => boolean;
  onSuccess: (orderId: string, buyer?: Buyer) => void;
}

// SEGNAPOSTO: il Client ID PayPal è un dato PUBBLICO (non un segreto), va bene metterlo nel
// file .env come VITE_PAYPAL_CLIENT_ID. Lo trovi su developer.paypal.com -> My Apps & Credentials
// (usa "Live" quando sei pronto a incassare davvero, "Sandbox" per fare prove).
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'YOUR_PAYPAL_CLIENT_ID';

export default function PayPalButton({ items, total, shippingCost = 0, dynamicShipping = false, onValidate, onSuccess }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Tiene traccia della spedizione più aggiornata scelta dentro al popup PayPal
  // (parte da 0 finché il cliente non ha ancora scelto un paese).
  const liveShippingRef = useRef(0);

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
              onClick: (_data: unknown, actions: any) => {
                if (onValidate && !onValidate()) {
                  return actions.reject();
                }
                return actions.resolve();
              },
              createOrder: (_data: unknown, actions: any) => {
                const itemTotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
                // In modalità dinamica partiamo da spedizione 0: verrà aggiornata
                // da onShippingAddressChange non appena il cliente sceglie il paese
                // dentro al popup PayPal, prima che possa confermare il pagamento.
                const initialShipping = dynamicShipping ? 0 : shippingCost;
                liveShippingRef.current = initialShipping;

                return actions.order.create({
                  purchase_units: [
                    {
                      reference_id: 'default',
                      amount: {
                        value: (itemTotal + initialShipping).toFixed(2),
                        currency_code: 'EUR',
                        breakdown: {
                          // PayPal richiede che item_total sia ESATTAMENTE la somma degli
                          // unit_amount degli items sotto — la spedizione va nel suo campo
                          // separato, altrimenti PayPal può rifiutare l'ordine.
                          item_total: { value: itemTotal.toFixed(2), currency_code: 'EUR' },
                          shipping: { value: initialShipping.toFixed(2), currency_code: 'EUR' },
                        },
                      },
                      items: items.map(i => ({
                        name: i.size ? `${i.product.title} — Taglia ${i.size}` : i.product.title,
                        unit_amount: { value: i.product.price.toFixed(2), currency_code: 'EUR' },
                        quantity: String(i.quantity),
                        category: 'PHYSICAL_GOODS',
                      })),
                    },
                  ],
                });
              },
              // Chiamato da PayPal appena il cliente sceglie/cambia il paese di
              // spedizione DENTRO al suo popup (nessun menu sul nostro sito).
              // Ricalcoliamo la spedizione vera e aggiorniamo il totale prima che
              // possa confermare il pagamento.
              onShippingAddressChange: dynamicShipping
                ? async (data: any, actions: any) => {
                    const country = data?.shippingAddress?.countryCode;
                    if (!country) return actions.reject();
                    try {
                      const res = await fetch(`/.netlify/functions/get-shipping-cost?country=${encodeURIComponent(country)}`);
                      const { shippingCost: liveCost } = await res.json();
                      liveShippingRef.current = liveCost;
                      const itemTotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
                      return actions.order.patch([
                        {
                          op: 'replace',
                          path: "/purchase_units/@reference_id=='default'/amount",
                          value: {
                            currency_code: 'EUR',
                            value: (itemTotal + liveCost).toFixed(2),
                            breakdown: {
                              item_total: { value: itemTotal.toFixed(2), currency_code: 'EUR' },
                              shipping: { value: liveCost.toFixed(2), currency_code: 'EUR' },
                            },
                          },
                        },
                      ]);
                    } catch {
                      return actions.reject();
                    }
                  }
                : undefined,
              onApprove: async (_data: unknown, actions: any) => {
                const details = await actions.order.capture();

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

                let orderId = '';
                try {
                  const itemTotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
                  const finalTotal = dynamicShipping ? itemTotal + liveShippingRef.current : total;
                  const res = await fetch('/.netlify/functions/generate-order-id', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      items: items.map(i => ({ handle: i.product.handle, quantity: i.quantity })),
                      buyer,
                      total: finalTotal,
                    }),
                  });
                  const data = await res.json();
                  orderId = data.orderId || '';
                } catch {
                  orderId = '';
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
  }, [items, total, dynamicShipping, onSuccess]);

  return <div ref={containerRef} className="paypal-button-container" />;
}
