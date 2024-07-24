import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
} from 'react';
import { useAppState } from '../hooks/useAppState';
import { vscode } from '../utils/vscode-api';
import {
  WebviewMessage,
  UpdateContentMessage,
  RepoSizeResultMessage,
  AppState,
} from '../../shared/types';
import { logger } from '../../shared/logger';

export interface AppContextType {
  state: AppState;
  setFileTree: (fileTree: string) => void;
  setCombinedContent: (content: string) => void;
  setError: (error: boolean) => void;
  setLoading: (loading: boolean) => void;
  setFileSelections: (selections: { [key: string]: boolean }) => void;
  setIsRoot: (isRoot: boolean) => void;
  setMode: (mode: 'directory' | 'root') => void;
  setAllFilesChecked: (checked: boolean) => void;
  setIsLargeRepo: (isLarge: boolean) => void;
  handleModeChange: (mode: 'directory' | 'root') => void;
  handleToggleFiles: (checked: boolean) => void;
  handleFileSelectionChange: (selections: { [key: string]: boolean }) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function isUpdateContentMessage(
  message: WebviewMessage,
): message is UpdateContentMessage {
  return message.command === 'updateContent' && 'fileTree' in message;
}

function isRepoSizeResultMessage(
  message: WebviewMessage,
): message is RepoSizeResultMessage {
  return message.command === 'repoSizeResult' && 'isLarge' in message;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    state,
    setFileTree,
    setCombinedContent,
    setError,
    setLoading,
    setIsRoot,
    setMode,
    setIsLargeRepo,
  } = useAppState();

  const handleMessage = useCallback(
    (message: WebviewMessage) => {
      logger.info('Received message in AppContext', message);
      switch (message.command) {
        case 'updateContent': {
          if (isUpdateContentMessage(message)) {
            logger.info('Updating content in AppContext', message);
            setFileTree(message.fileTree);
            setCombinedContent(message.combinedContent);
            setError(false);
            setLoading(false);
            setIsRoot(message.isRoot);
            setMode(message.mode);
          } else {
            logger.warn('Received invalid updateContent message', message);
          }
          break;
        }
        case 'showError': {
          logger.error('Error received in AppContext');
          setError(true);
          setLoading(false);
          break;
        }
        case 'repoSizeResult':
          if (isRepoSizeResultMessage(message)) {
            logger.info(`Repo size result received: ${message.isLarge}`);
            setIsLargeRepo(message.isLarge);
          } else {
            logger.warn('Received invalid repoSizeResult message');
          }
          break;
        default:
          logger.warn(`Unknown message command: ${message.command}`);
      }
    },
    [
      setFileTree,
      setCombinedContent,
      setError,
      setLoading,
      setIsRoot,
      setMode,
      setIsLargeRepo,
    ],
  );

  useEffect(() => {
    const messageListener = (event: MessageEvent) => {
      const message = event.data as WebviewMessage;
      handleMessage(message);
    };

    window.addEventListener('message', messageListener);
    vscode.postMessage({ command: 'checkRepoSize' });

    return () => window.removeEventListener('message', messageListener);
  }, [handleMessage]);

  useEffect(() => {
    logger.info('AppContext state changed:', state);
  }, [state]);

  return (
    <AppContext.Provider value={{ ...useAppState() }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
