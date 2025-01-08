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
