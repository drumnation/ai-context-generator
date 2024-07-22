import React from 'react';
import ControlsSection from './ControlsSection';
import FileTreeSection from './FileTreeSection';
import CombinedContentSection from './CombinedContentSection';
import ErrorMessageSection from './ErrorMessageSection';
import { VSCodeProgressRing } from '@vscode/webview-ui-toolkit/react';
import { useAppContext } from '../AppContext';

const Body: React.FC = () => {
  const { error, loading } = useAppContext();

  return (
    <div className="body-container">
      <ControlsSection />
      {error ? (
        <ErrorMessageSection />
      ) : loading ? (
        <div className="spinner-container">
          <VSCodeProgressRing />
        </div>
      ) : (
        <>
          <FileTreeSection />
          <CombinedContentSection />
        </>
      )}
    </div>
  );
};

export default Body;
