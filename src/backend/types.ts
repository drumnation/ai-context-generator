export interface CachedContent {
  fileTreeCache: string;
  combinedContentCache: string;
  rootFileTreeCache: string;
  rootCombinedContentCache: string;
  showRootFiletree: boolean;
  showRootCombined: boolean;
  fileSelections: { [key: string]: boolean };
}

export interface WebviewMessage {
  command: string;
  content?: string;
  checked?: boolean;
  selections?: { [key: string]: boolean };
  mode?: 'root' | 'directory';
}
