import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent('wms-pwa-offline-ready'));
    },
    onRegisterError(err) {
      console.warn('Falha ao registrar Service Worker PWA:', err);
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary fallbackTitle="Erro ao carregar EstoqueOS WMS">
    <App />
  </ErrorBoundary>
);
