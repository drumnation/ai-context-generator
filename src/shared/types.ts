export interface UpdateContentMessage {
  command: 'updateContent';
  fileTree: string;
  combinedContent: string;
  isRoot: boolean;
  mode: 'directory' | 'root';
  loading: boolean;
}

export interface RepoSizeResultMessage {
  command: 'repoSizeResult';
  isLarge: boolean;
  path: string;
  error?: string;
}

export interface CheckRepoSizeMessage {
  command: 'checkRepoSize';
  path: string;
}

export interface ShowErrorMessage {
  command: 'showError';
}

export interface ProcessingStartedMessage {
  command: 'processingStarted';
  isRoot: boolean;
  mode: 'directory' | 'root';
  loading: boolean;
}

export type WebviewMessage =
  | UpdateContentMessage
  | RepoSizeResultMessage
  | CheckRepoSizeMessage
  | ShowErrorMessage
  | HeartbeatMessage
  | ProcessingStartedMessage
  | { command: string; [key: string]: unknown };

export interface AppState {
  allFilesChecked: boolean;
  combinedContent: string;
  error: boolean;
  fileSelections: { [key: string]: boolean };
  fileTree: string;
  isLargeRepo: boolean;
  isRoot: boolean;
  loading: boolean;
  mode: 'directory' | 'root';
}

/**
 * Message envelope for robust communication between extension and webview
 */
export interface MessageEnvelope<T extends WebviewMessage> {
  id: string;
  timestamp: number;
  payload: T;
  requiresAck: boolean;
}

/**
 * Message acknowledgment response
 */
export interface MessageAcknowledgment {
  command: 'messageAck';
  id: string;
  status: 'success' | 'error';
  error?: string;
}

/**
 * Webview lifecycle messages
 */
export interface WebviewLifecycleMessage {
  command: 'webviewMounted' | 'webviewUnmounting';
  pendingOperations?: string[];
}

/**
 * Heartbeat message for health monitoring
 */
export interface HeartbeatMessage {
  command: 'heartbeat' | 'heartbeatResponse';
  timestamp: number;
}

/**
 * Processing options for handling large file operations
 */
export interface ProcessingOptions {
  chunkSize: number;
  delayBetweenChunks: number;
  cancelToken?: import('vscode').CancellationToken;
}

/**
 * Default chunk processing options
 */
export const DEFAULT_CHUNK_OPTIONS: ProcessingOptions = {
  chunkSize: 50,
  delayBetweenChunks: 10,
};
