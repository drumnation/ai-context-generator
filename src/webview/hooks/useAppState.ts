/* eslint-disable no-case-declarations */
import { useReducer, useCallback } from 'react';
import { AppState } from '../../shared/types';
import { vscode } from '../utils/vscode-api';
import { logger } from '../../shared/logger';

type Action =
  | { type: 'SET_FILE_TREE'; payload: string }
  | { type: 'SET_COMBINED_CONTENT'; payload: string }
  | { type: 'SET_ERROR'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_FILE_SELECTIONS'; payload: { [key: string]: boolean } }
  | { type: 'SET_IS_ROOT'; payload: boolean }
  | { type: 'SET_MODE'; payload: 'directory' | 'root' }
  | { type: 'SET_ALL_FILES_CHECKED'; payload: boolean }
  | { type: 'SET_IS_LARGE_REPO'; payload: boolean }
  | { type: 'CHANGE_MODE'; payload: 'directory' | 'root' }
  | { type: 'TOGGLE_FILES'; payload: boolean }
  | { type: 'FILE_SELECTION_CHANGE'; payload: { [key: string]: boolean } };

function reducer(state: AppState, action: Action): AppState {
  logger.info('>>> useAppState reducer: Action dispatched:', action);
  switch (action.type) {
    case 'SET_FILE_TREE':
      logger.info('Updating file tree', {
        oldTree: state.fileTree,
        newTree: action.payload,
      });
      return { ...state, fileTree: action.payload };
    case 'SET_COMBINED_CONTENT':
      logger.info('Updating combined content', {
        oldContentLength: state.combinedContent.length,
        newContentLength: action.payload.length,
      });
      return { ...state, combinedContent: action.payload };
    case 'SET_ERROR':
      logger.info(
        `useAppState reducer: Setting error state to ${action.payload}`,
      );
      return { ...state, error: action.payload };
    case 'SET_LOADING':
      logger.info(
        `useAppState reducer: Setting loading state to ${action.payload}`,
      );
      return { ...state, loading: action.payload };
    case 'SET_FILE_SELECTIONS':
      logger.info('Updating file selections');
      return { ...state, fileSelections: action.payload };
    case 'SET_IS_ROOT':
      logger.info(`Setting isRoot to ${action.payload}`);
      return { ...state, isRoot: action.payload };
    case 'SET_MODE':
      logger.info(`Setting mode to ${action.payload}`);
      return { ...state, mode: action.payload };
    case 'SET_ALL_FILES_CHECKED':
      logger.info(`Setting allFilesChecked to ${action.payload}`);
      return { ...state, allFilesChecked: action.payload };
    case 'SET_IS_LARGE_REPO':
      logger.info(`Setting isLargeRepo to ${action.payload}`);
      return { ...state, isLargeRepo: action.payload };
    case 'CHANGE_MODE':
      logger.info(
        `useAppState reducer: Mode change requested to ${action.payload}`,
      );
      return {
        ...state,
        mode: action.payload,
        isRoot: action.payload === 'root',
        loading: true,
      };
    case 'TOGGLE_FILES':
      logger.info(`Toggled all files to ${action.payload}`);
      return {
        ...state,
        allFilesChecked: action.payload,
        fileSelections: Object.fromEntries(
          Object.keys(state.fileSelections).map((key) => [key, action.payload]),
        ),
      };
    case 'FILE_SELECTION_CHANGE':
      logger.info('File selection changed');
      const newSelections = { ...state.fileSelections, ...action.payload };
      const allChecked = Object.values(newSelections).every(Boolean);
      return {
        ...state,
        fileSelections: newSelections,
        allFilesChecked: allChecked,
      };
    default:
      logger.warn('useAppState reducer: Unknown action type', action);
      return state;
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, {
    allFilesChecked: true,
    combinedContent: '',
    error: false,
    fileSelections: {},
    fileTree: '',
    isLargeRepo: false,
    isRoot: false,
    loading: true,
    mode: 'directory',
  });

  const setFileTree = useCallback((fileTree: string) => {
    logger.info('Setting file tree', { newTree: fileTree });
    dispatch({ type: 'SET_FILE_TREE', payload: fileTree });
  }, []);

  const setCombinedContent = useCallback((content: string) => {
    logger.info('Setting combined content', { contentLength: content.length });
    dispatch({ type: 'SET_COMBINED_CONTENT', payload: content });
  }, []);

  const setError = useCallback(
    (error: boolean) => dispatch({ type: 'SET_ERROR', payload: error }),
    [],
  );
  const setLoading = useCallback((loading: boolean) => {
    logger.info(`useAppState: Explicitly setting loading to ${loading}`);
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);
  const setFileSelections = useCallback(
    (selections: { [key: string]: boolean }) =>
      dispatch({ type: 'SET_FILE_SELECTIONS', payload: selections }),
    [],
  );
  const setIsRoot = useCallback(
    (isRoot: boolean) => dispatch({ type: 'SET_IS_ROOT', payload: isRoot }),
    [],
  );
  const setMode = useCallback(
    (mode: 'directory' | 'root') =>
      dispatch({ type: 'SET_MODE', payload: mode }),
    [],
  );
  const setAllFilesChecked = useCallback(
    (checked: boolean) =>
      dispatch({ type: 'SET_ALL_FILES_CHECKED', payload: checked }),
    [],
  );
  const setIsLargeRepo = useCallback(
    (isLarge: boolean) =>
      dispatch({ type: 'SET_IS_LARGE_REPO', payload: isLarge }),
    [],
  );

  const handleModeChange = useCallback((newMode: 'directory' | 'root') => {
    logger.info(`useAppState handleModeChange: Changing mode to ${newMode}`);
    dispatch({ type: 'CHANGE_MODE', payload: newMode });
    if (newMode === 'root') {
      logger.info(
        `useAppState handleModeChange: Posting loadRootMode to backend`,
      );
      vscode.postMessage({
        command: 'loadRootMode',
      });
    }
  }, []);

  const handleToggleFiles = useCallback((checked: boolean) => {
    dispatch({ type: 'TOGGLE_FILES', payload: checked });
    vscode.postMessage({ command: 'toggleFiles', checked });
  }, []);

  const handleFileSelectionChange = useCallback(
    (selections: { [key: string]: boolean }) => {
      dispatch({ type: 'FILE_SELECTION_CHANGE', payload: selections });
      vscode.postMessage({ command: 'fileSelectionChanged', selections });
    },
    [],
  );

  return {
    state,
    setFileTree,
    setCombinedContent,
    setError,
    setLoading,
    setFileSelections,
    setIsRoot,
    setMode,
    setAllFilesChecked,
    setIsLargeRepo,
    handleModeChange,
    handleToggleFiles,
    handleFileSelectionChange,
  };
}
