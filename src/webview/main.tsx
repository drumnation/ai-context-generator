console.log('main.tsx script started');

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('React and ReactDOM imported');

const root = document.getElementById('root');
console.log('Root element:', root);

if (root) {
    console.log('Attempting to render React app');
    try {
        ReactDOM.createRoot(root).render(
            <React.StrictMode>
                <App />
            </React.StrictMode>
        );
        console.log('React app rendered successfully');
    } catch (error) {
        console.error('Error rendering React app:', error);
    }
} else {
    console.error('Root element not found');
}