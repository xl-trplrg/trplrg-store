import { StrictMode } from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const container = document.getElementById('root')!;

// Le pagine prerenderizzate arrivano già con HTML dentro #root: ci "agganciamo"
// (hydrate) invece di ridisegnare tutto da zero. In sviluppo locale (npm run dev)
// #root è vuoto: in quel caso creiamo semplicemente una root normale.
if (container.hasChildNodes()) {
  hydrateRoot(
    container,
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
