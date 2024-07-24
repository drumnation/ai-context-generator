import React, { useCallback } from 'react';
import { VSCodeButton, VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react';
import { useAppContext } from '../contexts/AppContext';
import { vscode } from '../utils/vscode-api';
import { useFileTree } from '../hooks/useFileTree';

const FileTreeSection: React.FC = () => {
  const {
    state: { isRoot, mode, fileSelections },
  } = useAppContext();
  const { renderedFileTree, handleFileSelectionChange } = useFileTree();

  const handleCopyFileTree = () => {
    vscode.postMessage({ command: 'copyFileTree' });
  };

  const handleToggleRoot = useCallback(
    (checked: boolean) => {
      handleFileSelectionChange({
        ...fileSelections,
        root: checked,
      });
    },
    [fileSelections, handleFileSelectionChange],
  );

  return (
    <div className="theme-box" id="fileTreeSection">
      <div className="section-header">
        <div className="header-controls">
          <VSCodeButton id="copyFileTree" onClick={handleCopyFileTree}>
            <span slot="start" className="codicon codicon-copy"></span>
            Copy
          </VSCodeButton>
        </div>
      </div>
      <div className="title-row">
        <h2>Tree</h2>
        {!isRoot && mode === 'directory' && (
          <VSCodeCheckbox
            style={{ marginLeft: '10px' }}
            onChange={(e) =>
              handleToggleRoot((e.target as HTMLInputElement).checked)
            }
          >
            Toggle Root
          </VSCodeCheckbox>
        )}
      </div>
      <div className="content-box">
        {renderedFileTree.map(({ indent, content, isChecked, index }) => (
          <div
            key={index}
            className="file-checkbox"
            style={{ paddingLeft: `${indent.length * 8}px` }}
          >
            <span className="tree-line">{indent}</span>
            <VSCodeCheckbox
              checked={isChecked}
              onChange={(e) => {
                handleFileSelectionChange({
                  ...fileSelections,
                  [content]: (e.target as HTMLInputElement).checked,
                });
              }}
            >
              {content}
            </VSCodeCheckbox>
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(FileTreeSection);
