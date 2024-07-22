import React, { createContext, useContext, useState, useEffect } from 'react';
import { vscode } from './vscode-api';

interface AppState {
  fileTree: string;
  combinedContent: string;
  error: boolean;
  loading: boolean;
  fileSelections: { [key: string]: boolean };
  isRoot: boolean;
  mode: 'directory' | 'root';
  allFilesChecked: boolean;
}

interface AppContextType extends AppState {
  setFileTree: (fileTree: string) => void;
  setCombinedContent: (content: string) => void;
  setError: (error: boolean) => void;
  setLoading: (loading: boolean) => void;
  setFileSelections: (selections: { [key: string]: boolean }) => void;
  setIsRoot: (isRoot: boolean) => void;
  setMode: (mode: 'directory' | 'root') => void;
  setAllFilesChecked: (checked: boolean) => void;
  handleModeChange: (mode: 'directory' | 'root') => void;
  handleToggleFiles: (checked: boolean) => void;
  handleFileSelectionChange: (selections: { [key: string]: boolean }) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AppState>({
    fileTree: '',
    combinedContent: '',
    error: false,
    loading: true, // Ensure loading starts as true
    fileSelections: {},
    isRoot: false,
    mode: 'directory',
    allFilesChecked: true,
  });

  const setFileTree = (fileTree: string) =>
    setState((prev) => ({ ...prev, fileTree }));
  const setCombinedContent = (combinedContent: string) =>
    setState((prev) => ({ ...prev, combinedContent }));
  const setError = (error: boolean) => setState((prev) => ({ ...prev, error }));
  const setLoading = (loading: boolean) =>
    setState((prev) => ({ ...prev, loading }));
  const setFileSelections = (fileSelections: { [key: string]: boolean }) =>
    setState((prev) => ({ ...prev, fileSelections }));
  const setIsRoot = (isRoot: boolean) =>
    setState((prev) => ({ ...prev, isRoot }));
  const setMode = (mode: 'directory' | 'root') =>
    setState((prev) => ({ ...prev, mode }));
  const setAllFilesChecked = (allFilesChecked: boolean) =>
    setState((prev) => ({ ...prev, allFilesChecked }));

  const handleModeChange = (newMode: 'directory' | 'root') => {
    setMode(newMode);
    setIsRoot(newMode === 'root');
    vscode.postMessage({ command: 'changeMode', mode: newMode });
  };

  const handleToggleFiles = (checked: boolean) => {
    const newSelections = Object.fromEntries(
      Object.keys(state.fileSelections).map((key) => [key, checked]),
    );
    setFileSelections(newSelections);
    setAllFilesChecked(checked);
    vscode.postMessage({ command: 'toggleFiles', checked });
  };

  const handleFileSelectionChange = (selections: {
    [key: string]: boolean;
  }) => {
    setFileSelections(selections);
    const allChecked = Object.values(selections).every(Boolean);
    setAllFilesChecked(allChecked);
    vscode.postMessage({ command: 'fileSelectionChanged', selections });
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case 'updateContent': {
          const selections: { [key: string]: boolean } = {};
          message.fileTree.split('\n').forEach((line: string) => {
            const trimmedLine = line.trim();
            if (trimmedLine) {
              selections[trimmedLine] = true;
            }
          });
          setFileTree(message.fileTree);
          setCombinedContent(message.combinedContent);
          setError(false);
          setLoading(false); // Set loading to false when content is updated
          setIsRoot(message.isRoot);
          setMode(message.isRoot ? 'root' : 'directory');
          setFileSelections(selections);
          setAllFilesChecked(true);
          break;
        }
        case 'showError': {
          setError(true);
          setLoading(false);
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        setFileTree,
        setCombinedContent,
        setError,
        setLoading,
        setFileSelections,
        setIsRoot,
        setMode,
        setAllFilesChecked,
        handleModeChange,
        handleToggleFiles,
        handleFileSelectionChange,
      }}
    >
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
