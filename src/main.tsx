import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import 'leaflet/dist/leaflet.css';
import './utils/chartSetup';
import { prefetchAllToolsIdle } from './utils/toolLoader';

// Register Service Worker for PWA WebApp support & warm up offline cache
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration silently failed or not available in dev
    });
    // Idle background warmup of tool code chunks for true offline readiness
    prefetchAllToolsIdle();
  });
} else if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    prefetchAllToolsIdle();
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
