import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { Product } from '../data/products';

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

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD': {
      const qty = action.quantity ?? 1;
      const key = lineKey(action.product.handle, action.size);
      const existing = state.items.find(i => lineKey(i.product.handle, i.size) === key);
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
    case 'SET_QTY':
      return {
        ...state,
        items: state.items
          .map(i =>
            lineKey(i.product.handle, i.size) === lineKey(action.handle, action.size)
              ? { ...i, quantity: action.quantity }
              : i
          )
          .filter(i => i.quantity > 0),
      };
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

function init(): CartState {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...JSON.parse(stored), isOpen: false };
    } catch { /* ignore */ }
  }
  return { items: [], isOpen: false };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items }));
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
