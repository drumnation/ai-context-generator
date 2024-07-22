import React from 'react';
import {
  VSCodeButton,
  VSCodeCheckbox,
  VSCodeRadioGroup,
  VSCodeRadio,
} from '@vscode/webview-ui-toolkit/react';
import { useAppContext } from '../AppContext';
import { vscode } from '../vscode-api';

const ControlsSection: React.FC = () => {
  const { mode, isRoot, allFilesChecked, handleModeChange, handleToggleFiles } =
    useAppContext();

  const handleCopyAll = () => {
    vscode.postMessage({ command: 'copyAll' });
  };

  return (
    <div className="theme-box controls">
      <VSCodeButton id="copyAll" appearance="primary" onClick={handleCopyAll}>
        <span slot="start" className="codicon codicon-copy"></span>
        Copy All
      </VSCodeButton>
      {!isRoot && (
        <VSCodeRadioGroup
          orientation="horizontal"
          value={mode}
          onChange={(e) =>
            handleModeChange(
              (e.target as HTMLInputElement).value as 'directory' | 'root',
            )
          }
        >
          <VSCodeRadio value="directory" checked={mode === 'directory'}>
            Directory Mode
          </VSCodeRadio>
          <VSCodeRadio value="root" checked={mode === 'root'}>
            Root Mode
          </VSCodeRadio>
        </VSCodeRadioGroup>
      )}
      <VSCodeCheckbox
        id="toggleFiles"
        checked={allFilesChecked}
        onChange={(e) =>
          handleToggleFiles((e.target as HTMLInputElement).checked)
        }
      >
        Toggle Files
      </VSCodeCheckbox>
    </div>
  );
};

export default ControlsSection;
