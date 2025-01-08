import React from 'react';
import { VSCodeButton, VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react';
import { useAppContext } from '../contexts/AppContext';
import { vscode } from '../utils/vscode-api';

const CombinedContentSection: React.FC = () => {
  const {
    state: { combinedContent, fileSelections, isRoot, mode },
    handleFileSelectionChange,
  } = useAppContext();

  const handleCopyCombinedContent = () => {
    vscode.postMessage({ command: 'copyCombinedContent' });
  };

  const handleToggleRootCombined = (checked: boolean) => {
    handleFileSelectionChange({ ...fileSelections, rootCombined: checked });
  };

  return (
    <div className="theme-box" id="combinedContentSection">
      <div className="section-header">
        <div className="header-controls">
          <VSCodeButton
            id="copyCombinedContent"
            onClick={handleCopyCombinedContent}
          >
            <span slot="start" className="codicon codicon-copy"></span>
            Copy
          </VSCodeButton>
        </div>
      </div>
      <div className="title-row">
        <h2>Files</h2>
        {!isRoot && mode === 'directory' && (
          <VSCodeCheckbox
            style={{ marginLeft: '10px' }}
            onChange={(e) =>
              handleToggleRootCombined((e.target as HTMLInputElement).checked)
            }
          >
            Toggle Root
          </VSCodeCheckbox>
        )}
      </div>
      <div className="content-box">
        <pre id="combinedContent">{combinedContent}</pre>
      </div>
    </div>
  );
};

export default CombinedContentSection;
