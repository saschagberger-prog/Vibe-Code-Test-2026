import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { store } from './store/store';
import './styles.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline caching optional */
    });
  });
}

void store.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
