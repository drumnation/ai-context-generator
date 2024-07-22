import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  body { 
    padding: 20px; 
    --vscode-button-icon-size: 16px;
  }
  pre { 
    white-space: pre-wrap; 
    word-break: break-all; 
    background-color: var(--vscode-textCodeBlock-background);
    padding: 10px;
    border-radius: 3px;
  }
  .theme-box { 
    border: 1px solid var(--vscode-editor-foreground); 
    padding: 10px; 
    margin-bottom: 20px; 
    position: relative;
  }
  .controls {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    align-items: center;
  }
  .section-header {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    margin-bottom: 10px;
  }
  .header-controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .title {
    margin-top: 10px;
    margin-bottom: 10px;
  }
  h2 {
    margin: 0; 
  }
  .content-box {
    margin-top: 10px;
  }
  .file-checkbox {
    display: flex;
    align-items: center;
    margin-bottom: 5px;
  }
  .file-checkbox vscode-checkbox {
    margin-right: 5px;
  }
  .title-row {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }

  .title-row h2 {
    margin: 0;
    margin-right: 10px;
  }

  .tree-line {
    font-family: monospace;
    white-space: pre;
  }
`;

export default GlobalStyle;
