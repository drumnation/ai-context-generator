import React from 'react';
import { VSCodeButton, VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react';
import { useAppContext } from '../AppContext';
import { vscode } from '../vscode-api';

const FileTreeSection: React.FC = () => {
  const { fileTree, fileSelections, handleFileSelectionChange, isRoot, mode } =
    useAppContext();

  const handleCopyFileTree = () => {
    vscode.postMessage({ command: 'copyFileTree' });
  };

  const renderFileTree = (tree: string) => {
    return tree.split('\n').map((line, index) => {
      const match = line.match(/^([│├└─\s]*)(.*)/);
      const indent = match ? match[1] : '';
      const content = match ? match[2] : line;
      const isChecked = fileSelections[content] !== false;

      return (
        <div
          key={index}
          className="file-checkbox"
          style={{ paddingLeft: `${indent.length * 8}px` }}
        >
          <span className="tree-line">{indent}</span>
          <VSCodeCheckbox
            checked={isChecked}
            onChange={(e) => {
              const newSelections = {
                ...fileSelections,
                [content]: (e.target as HTMLInputElement).checked,
              };
              handleFileSelectionChange(newSelections);
            }}
          >
            {content}
          </VSCodeCheckbox>
        </div>
      );
    });
  };

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
              handleFileSelectionChange({
                ...fileSelections,
                root: (e.target as HTMLInputElement).checked,
              })
            }
          >
            Toggle Root
          </VSCodeCheckbox>
        )}
      </div>
      <div className="content-box">{renderFileTree(fileTree)}</div>
    </div>
  );
};

export default FileTreeSection;
