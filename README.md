# TRPLRG Store

E-commerce di [trplrg.com](https://trplrg.com): vendita di vinile, CD, maglietta e felpa del progetto musicale XL, con checkout Stripe, PayPal e Google Pay. React + TypeScript + Vite lato client, Netlify Functions lato server, deploy su Netlify.

## Stack

- **Frontend:** React 19, TypeScript, React Router, Vite (con pre-rendering SSR delle pagine prodotto per la SEO, vedi `scripts/prerender.mjs`)
- **Backend:** Netlify Functions (`netlify/functions/*.cjs`)
- **Pagamenti:** Stripe Checkout, Google Pay (via Stripe), PayPal
- **Storage:** Netlify Blobs (scorte, contatori ordini, dettagli ordine, articoli PayPal pending)
- **Newsletter:** Brevo

## Setup locale

```bash
npm install
cp .env.example .env   # poi compila i valori reali — vedi commenti nel file
npm run dev
```

Per testare anche le Netlify Functions in locale serve la [Netlify CLI](https://docs.netlify.com/cli/get-started/):

```bash
npm install -g netlify-cli
netlify dev
```

## Script disponibili

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Server di sviluppo Vite |
| `npm run build` | Build di produzione (client) + build SSR + pre-rendering delle pagine prodotto (`postbuild`) |
| `npm run preview` | Anteprima locale della build di produzione |
| `npm run lint` | Lint con Oxlint |

## Struttura del progetto

```
src/
  components/     Componenti UI (bottoni di pagamento, carrello, card prodotto, ...)
  context/        CartContext (stato carrello, limiti quantità)
  data/           Cataloghi lato client: products.ts, shipping.ts (devono restare
                  coerenti con le rispettive fonti di verità server-side, vedi sotto)
  pages/          Una pagina per route (Home, ProductDetail, CartPage, ...)
  entry-server.tsx  Entry point per il pre-rendering SSR

netlify/functions/
  *.cjs           Una function per endpoint (checkout Stripe, ordini PayPal,
                   addebito Google Pay, webhook Stripe, newsletter, ...)
  lib/            Logica condivisa tra le function: prezzi, spedizione, scorte,
                   generazione Order ID, client PayPal, invio alert scorte
```

### Fonti di verità duplicate client/server

Alcuni dati esistono in due posti (uno per la UI, uno per la logica di
pagamento server-side) e vanno tenuti manualmente allineati se cambiano:

- **Prezzi/catalogo:** `src/data/products.ts` (client) / `netlify/functions/lib/prices.cjs` (server)
- **Spedizione:** `src/data/shipping.ts` (client) / `netlify/functions/lib/shipping.cjs` (server)
- **Limite pezzi per prodotto:** `MAX_PER_PRODUCT` in `src/context/CartContext.tsx` (client) / `netlify/functions/lib/stock.cjs` (server)

Il server non si fida mai dei valori mandati dal client per calcolare importi o
applicare limiti: quelli lato client servono solo a mostrare la UI corretta
prima ancora di arrivare al pagamento.

## Scorte e pagamenti

Le scorte (`netlify/functions/lib/stock.cjs`) sono salvate su Netlify Blobs con
scritture atomiche condizionate (etag), per evitare che due acquisti
simultanei dell'ultimo pezzo vadano entrambi a buon fine. Il decremento vero
avviene solo DOPO la conferma del pagamento (`decrementStockOnce`, con chiave
di idempotenza per evitare doppi decrementi su retry/webhook ripetuti). Se le
scorte finiscono a metà ordine, viene inviata un'email di alert al venditore
via Brevo (vedi `lib/stock-alert.cjs` e le variabili `SELLER_ALERT_EMAIL` /
`BREVO_SENDER_EMAIL` in `.env.example`).

## Deploy

Il deploy è automatico su push, gestito da Netlify (`netlify.toml`): build
command `npm run build`, publish directory `dist`, functions in
`netlify/functions`. Le variabili d'ambiente vanno configurate su Netlify
(Site settings -> Environment variables), non nel repo.

## Link ufficiali

- [Sito ufficiale](https://trplrg.com)
- [Instagram](https://www.instagram.com/trplrg/)
- [Facebook](https://www.facebook.com/profile.php?id=61593870356425)
- [YouTube](https://www.youtube.com/@XLTRPLRG)
