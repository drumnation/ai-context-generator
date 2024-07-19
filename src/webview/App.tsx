// import React, { useState, useEffect } from 'react';
// import { VSCodeButton, VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react';

// declare function acquireVsCodeApi(): {
//     postMessage: (message: any) => void;
//     getState: () => any;
//     setState: (state: any) => void;
// };


// const App: React.FC = () => {
//     const [showRootFiletree, setShowRootFiletree] = useState(false);
//     const [showRootCombined, setShowRootCombined] = useState(false);
//     const [fileTree, setFileTree] = useState('');
//     const [combinedContent, setCombinedContent] = useState('');

//     useEffect(() => {
//         const vscode = acquireVsCodeApi();
//         window.addEventListener('message', (event) => {
//             const message = event.data;
//             if (message.fileTree) {
//                 setFileTree(message.fileTree);
//             }
//             if (message.combinedContent) {
//                 setCombinedContent(message.combinedContent);
//             }
//         });
//         vscode.postMessage({ command: 'initialize' });
//     }, []);

//     const handleCopy = (content: string) => {
//         const vscode = acquireVsCodeApi();
//         vscode.postMessage({ command: 'copyToClipboard', content });
//     };

//     return (
//         <div style={{ padding: '20px' }}>
//             <div className="options-container">
//                 <VSCodeButton onClick={() => handleCopy(document.body.innerText)}>
//                     Copy to Clipboard
//                 </VSCodeButton>
//                 <div className="options-header">AI Context Options</div>
//                 <div className="options">
//                     <VSCodeCheckbox
//                         checked={showRootFiletree}
//                         onChange={() => setShowRootFiletree(!showRootFiletree)}
//                     >
//                         Root Filetree
//                     </VSCodeCheckbox>
//                     <VSCodeCheckbox
//                         checked={showRootCombined}
//                         onChange={() => setShowRootCombined(!showRootCombined)}
//                     >
//                         Root Combined Files
//                     </VSCodeCheckbox>
//                 </div>
//             </div>
//             <div className="content-section">
//                 <h2>File Tree</h2>
//                 <VSCodeButton onClick={() => handleCopy(fileTree)}>
//                     Copy
//                 </VSCodeButton>
//             </div>
//             <pre id="fileTree">{fileTree}</pre>
//             <div className="content-section">
//                 <h2>Combined Content</h2>
//                 <VSCodeButton onClick={() => handleCopy(combinedContent)}>
//                     Copy
//                 </VSCodeButton>
//             </div>
//             <pre id="combinedContent">{combinedContent}</pre>
//         </div>
//     );
// };

// export default App;

import React, { useState, useEffect } from 'react';

declare const acquireVsCodeApi: () => any;

const vscode = acquireVsCodeApi();

interface ContentData {
  fileTree: string;
  combinedContent: string;
  isRoot: boolean;
}

const App: React.FC = () => {
  const [content, setContent] = useState<ContentData | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('Message received in React app:', message);
      if (message.command === 'updateContent') {
        setContent(message);
      }
    };

    window.addEventListener('message', handleMessage);

    // Notify the extension that the webview is ready
    vscode.postMessage({ command: 'webviewLoaded' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleCopy = (text: string) => {
    vscode.postMessage({ command: 'copyToClipboard', content: text });
  };

  if (!content) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', color: 'white', backgroundColor: '#1e1e1e' }}>
      <h1 style={{ color: '#0078D4' }}>AI-Pack Generated Markdown</h1>
      
      <h2>File Tree</h2>
      <button onClick={() => handleCopy(content.fileTree)}>Copy File Tree</button>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{content.fileTree}</pre>
      
      <h2>Combined Content</h2>
      <button onClick={() => handleCopy(content.combinedContent)}>Copy Combined Content</button>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{content.combinedContent}</pre>
    </div>
  );
};

export default App;