import React, { useEffect } from 'react';
import ControlsSection from './ControlsSection';
import FileTreeSection from './FileTreeSection';
import CombinedContentSection from './CombinedContentSection';
import ErrorMessageSection from './ErrorMessageSection';
import { VSCodeProgressRing } from '@vscode/webview-ui-toolkit/react';
import { useAppContext } from '../contexts/AppContext';
import { logger } from '../../shared/logger';

const Body: React.FC = () => {
  const {
    state: { error, loading, fileTree, combinedContent, mode },
  } = useAppContext();

  useEffect(() => {
    logger.info('Body state changed:', {
      error,
      loading,
      hasFileTree: !!fileTree,
      hasCombinedContent: !!combinedContent,
      mode,
    });
  }, [error, loading, fileTree, combinedContent, mode]);

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
