import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import { getProduct, type Product } from '../data/products';

export interface CartItem {
  product: Product;
  quantity: number;
  size?: string;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
}

// La riga carrello è identificata da handle + taglia (due taglie diverse = due righe distinte)
function lineKey(handle: string, size?: string) {
  return size ? `${handle}__${size}` : handle;
}

type CartAction =
  | { type: 'ADD'; product: Product; quantity?: number; size?: string }
  | { type: 'REMOVE'; handle: string; size?: string }
  | { type: 'SET_QTY'; handle: string; size?: string; quantity: number }
  | { type: 'CLEAR' }
  | { type: 'OPEN' }
  | { type: 'CLOSE' };

const STORAGE_KEY = 'xl-cart';

// Stesso limite imposto anche lato server (vedi netlify/functions/lib/stock.cjs).
// Tenuto qui separato: se cambia uno dei due, l'altro va aggiornato a mano.
const MAX_PER_PRODUCT = 10;

// Somma le quantità già in carrello per lo stesso prodotto, taglie comprese.
function totalForHandle(items: CartItem[], handle: string) {
  return items.reduce((sum, i) => (i.product.handle === handle ? sum + i.quantity : sum), 0);
}

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD': {
      const key = lineKey(action.product.handle, action.size);
      const existing = state.items.find(i => lineKey(i.product.handle, i.size) === key);
      const currentTotal = totalForHandle(state.items, action.product.handle);
      const requested = action.quantity ?? 1;
      const allowed = Math.max(0, MAX_PER_PRODUCT - currentTotal);
      const qty = Math.min(requested, allowed);
      if (qty <= 0) return state;
      const items = existing
        ? state.items.map(i =>
            lineKey(i.product.handle, i.size) === key
              ? { ...i, quantity: i.quantity + qty }
              : i
          )
        : [...state.items, { product: action.product, quantity: qty, size: action.size }];
      return { ...state, items, isOpen: true };
    }
    case 'REMOVE':
      return { ...state, items: state.items.filter(i => lineKey(i.product.handle, i.size) !== lineKey(action.handle, action.size)) };
    case 'SET_QTY': {
      const key = lineKey(action.handle, action.size);
      const otherLinesTotal = state.items.reduce(
        (sum, i) => (i.product.handle === action.handle && lineKey(i.product.handle, i.size) !== key ? sum + i.quantity : sum),
        0
      );
      const allowed = Math.max(0, MAX_PER_PRODUCT - otherLinesTotal);
      const clampedQty = Math.min(action.quantity, allowed);
      return {
        ...state,
        items: state.items
          .map(i =>
            lineKey(i.product.handle, i.size) === key
              ? { ...i, quantity: clampedQty }
              : i
          )
          .filter(i => i.quantity > 0),
      };
    }
    case 'CLEAR':
      return { ...state, items: [] };
    case 'OPEN':
      return { ...state, isOpen: true };
    case 'CLOSE':
      return { ...state, isOpen: false };
    default:
      return state;
  }
}

interface CartContextValue extends CartState {
  add: (product: Product, quantity?: number, size?: string) => void;
  remove: (handle: string, size?: string) => void;
  setQty: (handle: string, quantity: number, size?: string) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
  count: number;
  total: number;
}

const CartContext = createContext<CartContextValue | null>(null);

// Forma minima salvata su localStorage: SOLO il riferimento al prodotto
// (handle + taglia) e la quantità, mai una "fotografia" di nome/prezzo/
// immagine. Il prodotto vero viene sempre riletto da products.ts al
// caricamento (vedi init()) così, se cambia un'immagine, un prezzo o un
// titolo — o un prodotto viene rimosso dal catalogo — un carrello salvato
// giorni o settimane prima riflette subito lo stato attuale invece di
// restare bloccato su dati vecchi (causa delle miniature "rotte" viste
// in carrelli di test rimasti da prima di una modifica alle immagini).
interface StoredCartLine {
  handle: string;
  quantity: number;
  size?: string;
}

function init(): CartState {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const rawLines: unknown = Array.isArray(parsed?.items) ? parsed.items : [];
        const items: CartItem[] = (rawLines as any[])
          .map((line): CartItem | null => {
            // Retrocompatibilità: i carrelli salvati con la versione precedente
            // contenevano { product: {...}, quantity, size }. Accettiamo
            // entrambe le forme ma ricostruiamo SEMPRE il prodotto da
            // products.ts, ignorando qualunque dato prodotto già presente
            // nel salvataggio.
            const handle: string | undefined = line?.handle ?? line?.product?.handle;
            const quantity = Number(line?.quantity);
            if (!handle || !Number.isFinite(quantity) || quantity <= 0) return null;
            const product = getProduct(handle);
            if (!product) return null; // prodotto rimosso dal catalogo: riga scartata
            return { product, quantity, size: line?.size };
          })
          .filter((i): i is CartItem => i !== null);
        return { items, isOpen: false };
      }
    } catch { /* ignore */ }
  }
  return { items: [], isOpen: false };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    try {
      const toStore: StoredCartLine[] = state.items.map(i => ({
        handle: i.product.handle,
        quantity: i.quantity,
        size: i.size,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: toStore }));
    } catch { /* ignore */ }
  }, [state.items]);

  const count = state.items.reduce((s, i) => s + i.quantity, 0);
  const total = state.items.reduce((s, i) => s + i.quantity * i.product.price, 0);

  const value: CartContextValue = {
    ...state,
    add: (product, quantity, size) => dispatch({ type: 'ADD', product, quantity, size }),
    remove: (handle, size) => dispatch({ type: 'REMOVE', handle, size }),
    setQty: (handle, quantity, size) => dispatch({ type: 'SET_QTY', handle, quantity, size }),
    clear: () => dispatch({ type: 'CLEAR' }),
    openCart: () => dispatch({ type: 'OPEN' }),
    closeCart: () => dispatch({ type: 'CLOSE' }),
    count,
    total,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
