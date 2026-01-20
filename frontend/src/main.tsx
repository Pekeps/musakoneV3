import { render } from 'preact';
import { App } from './App';
import './styles/index.css';

const appElement = document.getElementById('app');
if (appElement) {
  render(<App />, appElement);
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}
