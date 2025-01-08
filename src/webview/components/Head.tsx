import React from 'react';

const Head: React.FC = () => {
  return (
    <>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <script
        type="module"
        src="https://unpkg.com/@vscode/webview-ui-toolkit@1.4.0/dist/toolkit.css"
      ></script>
      <link
        href="https://unpkg.com/@vscode/codicons@0.0.32/dist/codicon.css"
        rel="stylesheet"
      />
      <title>AI-Pack Webview</title>
    </>
  );
};

export default Head;
