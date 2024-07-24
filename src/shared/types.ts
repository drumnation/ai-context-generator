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
}

export interface ShowErrorMessage {
  command: 'showError';
}

export type WebviewMessage =
  | UpdateContentMessage
  | RepoSizeResultMessage
  | ShowErrorMessage
  | { command: string };

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
