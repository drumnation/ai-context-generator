export interface UpdateContentMessage {
  command: 'updateContent';
  fileTree: string;
  combinedContent: string;
  isRoot: boolean;
  mode: 'directory' | 'root';
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
