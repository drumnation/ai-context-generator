import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

declare global {
  interface Window {
    acquireVsCodeApi: () => VsCodeApi;
  }
}

interface VsCodeApi {
  postMessage: (message: unknown) => void;
}

interface Message {
  command: string;
  fileTree?: string;
  combinedContent?: string;
  [key: string]: unknown;
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

window.addEventListener('message', (event) => {
  const message: Message = event.data;
  switch (message.command) {
    case 'updateContent':
      if (message.fileTree && message.combinedContent) {
        updateContent({
          fileTree: message.fileTree,
          combinedContent: message.combinedContent,
        });
      }
      break;
    case 'showError':
      showError();
      break;
  }
});

function updateContent(message: { fileTree: string; combinedContent: string }) {
  const event = new CustomEvent('updateContent', { detail: message });
  window.dispatchEvent(event);
}

function showError() {
  const event = new CustomEvent('showError');
  window.dispatchEvent(event);
}
