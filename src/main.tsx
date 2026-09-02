import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Ensure dark class is removed if previously set in localStorage
document.documentElement.classList.remove('dark');
try {
  localStorage.removeItem('bk_talabat_theme');
} catch {
  // ignore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


