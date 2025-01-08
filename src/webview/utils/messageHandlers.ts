import { logger } from '../../shared/logger';
import { AppState } from '../types';

interface UpdateContentMessage {
  command: 'updateContent';
  fileTree: string;
  combinedContent: string;
  isRoot: boolean;
  mode: 'directory' | 'root';
  loading: boolean;
}

interface RepoSizeResultMessage {
  command: 'repoSizeResult';
  isLarge: boolean;
}

interface ShowErrorMessage {
  command: 'showError';
}

type WebviewMessage =
  | UpdateContentMessage
  | RepoSizeResultMessage
  | ShowErrorMessage
  | { command: string };

export const handleUpdateContent = (
  message: UpdateContentMessage,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
) => {
  logger.info('Handling updateContent message', message);
  setState((prevState) => ({
    ...prevState,
    fileTree: message.fileTree,
    combinedContent: message.combinedContent,
    error: false,
    loading: message.loading,
    isRoot: message.isRoot,
    mode: message.mode,
    fileSelections: message.fileTree.split('\n').reduce(
      (acc: { [key: string]: boolean }, line: string) => {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          acc[trimmedLine] = true;
        }
        return acc;
      },
      {} as { [key: string]: boolean },
    ),
  }));
};

export const handleShowError = (
  setState: React.Dispatch<React.SetStateAction<AppState>>,
) => {
  logger.error('Showing error message');
  setState((prevState) => ({
    ...prevState,
    error: true,
    loading: false,
  }));
};

export const handleRepoSizeResult = (
  message: RepoSizeResultMessage,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
) => {
  logger.info('Handling repoSizeResult message', message);
  setState((prevState) => ({
    ...prevState,
    isLargeRepo: message.isLarge,
  }));
};

export const handleMessage = (
  message: WebviewMessage,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
) => {
  switch (message.command) {
    case 'updateContent':
      if (isUpdateContentMessage(message)) {
        handleUpdateContent(message, setState);
      } else {
        logger.warn('Invalid updateContent message', message);
      }
      break;
    case 'showError':
      handleShowError(setState);
      break;
    case 'repoSizeResult':
      if (isRepoSizeResultMessage(message)) {
        handleRepoSizeResult(message, setState);
      } else {
        logger.warn('Invalid repoSizeResult message', message);
      }
      break;
    default:
      logger.warn('Unknown message command', message);
  }
};

// Type guards
function isUpdateContentMessage(
  message: WebviewMessage,
): message is UpdateContentMessage {
  return (
    message.command === 'updateContent' &&
    'fileTree' in message &&
    'combinedContent' in message &&
    'isRoot' in message &&
    'mode' in message
  );
}

function isRepoSizeResultMessage(
  message: WebviewMessage,
): message is RepoSizeResultMessage {
  return message.command === 'repoSizeResult' && 'isLarge' in message;
}
