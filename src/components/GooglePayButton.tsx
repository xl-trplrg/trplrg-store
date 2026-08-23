import { useEffect, useRef } from 'react';
import type { CartItem } from '../context/CartContext';

declare global {
  interface Window {
    google?: any;
  }
}

interface Buyer {
  name: string;
  address: string;
}

interface Props {
  items: CartItem[];
  total: number;
  country: string;
  onSuccess: (orderId: string, buyer?: Buyer) => void;
}

// SEGNAPOSTO: la chiave pubblicabile Stripe è un dato PUBBLICO (non un segreto), va bene
// metterla nel file .env come VITE_STRIPE_PUBLISHABLE_KEY. La trovi su dashboard.stripe.com
// -> Sviluppatori -> Chiavi API -> "Publishable key" (inizia con pk_live_... o pk_test_...).
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

// ATTENZIONE MODALITÀ: mentre siamo in fase di test, l'ambiente è 'TEST' (nessuna registrazione
// richiesta, nessun soldo vero si muove). Per accettare pagamenti VERI bisogna:
// 1. Registrare un Merchant ID gratuito su https://pay.google.com/business/console
// 2. Cambiare ENVIRONMENT in 'PRODUCTION' qui sotto
// 3. Aggiungere quel Merchant ID in merchantInfo.merchantId
// 4. Assicurarsi che VITE_STRIPE_PUBLISHABLE_KEY e STRIPE_SECRET_KEY (su Netlify) siano
//    ENTRAMBE "live" (pk_live_... e sk_live_...) oppure ENTRAMBE "test" — non mischiate,
//    altrimenti il pagamento viene rifiutato da Stripe.
const ENVIRONMENT: 'TEST' | 'PRODUCTION' = 'PRODUCTION';

const allowedCardNetworks = ['AMEX', 'DISCOVER', 'MASTERCARD', 'VISA'];
const allowedCardAuthMethods = ['PAN_ONLY', 'CRYPTOGRAM_3DS'];

const baseCardPaymentMethod = {
  type: 'CARD',
  parameters: {
    allowedAuthMethods: allowedCardAuthMethods,
    allowedCardNetworks: allowedCardNetworks,
  },
};

const tokenizationSpecification = {
  type: 'PAYMENT_GATEWAY',
  parameters: {
    gateway: 'stripe',
    'stripe:version': '2020-08-27',
    'stripe:publishableKey': STRIPE_PUBLISHABLE_KEY,
  },
};

const cardPaymentMethod = {
  ...baseCardPaymentMethod,
  tokenizationSpecification,
};

export default function GooglePayButton({ items, total, country, onSuccess }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || items.length === 0 || !STRIPE_PUBLISHABLE_KEY) return;

    let cancelled = false;

    const init = () => {
      if (!window.google || !containerRef.current || cancelled) return;

      const client = new window.google.payments.api.PaymentsClient({ environment: ENVIRONMENT });
      clientRef.current = client;

      client
        .isReadyToPay({
          apiVersion: 2,
          apiVersionMinor: 0,
          allowedPaymentMethods: [baseCardPaymentMethod],
        })
        .then((response: { result: boolean }) => {
          if (!response.result || !containerRef.current || cancelled) return;

          // Aspettiamo che il browser abbia finito di calcolare il layout (flexbox)
          // prima di far disegnare a Google il bottone, altrimenti misura una larghezza
          // sbagliata (spesso 0) e il bottone finisce sovrapposto a quello di PayPal.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (!containerRef.current || cancelled) return;
              containerRef.current.innerHTML = '';
              const button = client.createButton({
                buttonType: 'plain',
                buttonSizeMode: 'fill',
                buttonRadius: 10,
                onClick: handleClick,
              });
              containerRef.current.appendChild(button);
            });
          });
        })
        .catch(() => {
          // Google Pay non disponibile per questo utente/browser: semplicemente non mostriamo il bottone.
        });
    };

    const handleClick = async () => {
      const client = clientRef.current;
      if (!client) return;

      try {
        const paymentData = await client.loadPaymentData({
          apiVersion: 2,
          apiVersionMinor: 0,
          allowedPaymentMethods: [cardPaymentMethod],
          merchantInfo: {
            merchantName: 'TRPLRG',
            merchantId: 'BCR2DN7TTC2L3HZB',
          },
          transactionInfo: {
            totalPriceStatus: 'FINAL',
            totalPrice: total.toFixed(2),
            currencyCode: 'EUR',
            countryCode: 'IT',
          },
          emailRequired: true,
          shippingAddressRequired: true,
          shippingAddressParameters: { phoneNumberRequired: false },
        });

        const address = paymentData.shippingAddress;
        const buyer = address
          ? {
              name: address.name || '',
              address: `${[address.address1, address.address2].filter(Boolean).join(', ')}, ${address.postalCode || ''} ${address.locality || ''}${address.administrativeArea ? ' (' + address.administrativeArea + ')' : ''} - ${address.countryCode || ''}`,
            }
          : undefined;

        const stripeToken = JSON.parse(paymentData.paymentMethodData.tokenizationData.token);

        const res = await fetch('/.netlify/functions/google-pay-charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenId: stripeToken.id,
            items: items.map(i => ({ handle: i.product.handle, quantity: i.quantity, size: i.size })),
            country,
            email: paymentData.email,
          }),
        });

        const data = await res.json();
        if (data.success) {
          onSuccess(data.orderId, buyer);
        }
      } catch (err: any) {
        // L'utente ha chiuso la finestra Google Pay, oppure errore: non facciamo nulla di rumoroso.
        if (err?.statusCode !== 'CANCELED') {
          console.error('Google Pay error:', err);
        }
      }
    };

    if (window.google) {
      init();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-googlepay-sdk]');
      if (existing) {
        existing.addEventListener('load', init, { once: true });
      } else {
        const script = document.createElement('script');
        script.dataset.googlepaySdk = 'true';
        script.src = 'https://pay.google.com/gp/p/js/pay.js';
        script.onload = init;
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [items, total, country, onSuccess]);

  return <div ref={containerRef} className="google-pay-button-container" />;
}
