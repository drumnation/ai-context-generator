import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/index.css';

// Add a log right at the start of the script execution
console.log('>>> webview/index.tsx: Script starting execution <<<');

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    // <React.StrictMode> // Temporarily remove StrictMode to avoid dev double-invoke issues
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
    // </React.StrictMode>,
  );
} else {
  console.error('Failed to find the root element');
}
