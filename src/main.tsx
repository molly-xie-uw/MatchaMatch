import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silencing benign Vite HMR connection errors in this environment
const isViteError = (err: any) => {
  const msg = String(err);
  return msg.includes('WebSocket') || msg.includes('vite') || msg.includes('WebSocket closed without opened');
};

window.addEventListener('unhandledrejection', (event) => {
  if (isViteError(event.reason)) {
    event.preventDefault();
    event.stopPropagation();
  }
});

window.addEventListener('error', (event) => {
  if (isViteError(event.error) || isViteError(event.message)) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

// Patch console.error to prevent the actual red text in the console for these
const originalConsoleError = console.error;
console.error = (...args) => {
  if (args.some(arg => isViteError(arg))) return;
  originalConsoleError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
