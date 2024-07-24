import { useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';

export function useFileTree() {
  const { state, handleFileSelectionChange } = useAppContext();
  const { fileTree, fileSelections } = state;

  const renderedFileTree = useMemo(() => {
    return fileTree.split('\n').map((line: string, index: number) => {
      const match = line.match(/^([│├└─\s]*)(.*)/);
      const indent = match ? match[1] : '';
      const content = match ? match[2] : line;
      const isChecked = fileSelections[content] !== false;

      return { indent, content, isChecked, index };
    });
  }, [fileTree, fileSelections]);

  return { renderedFileTree, handleFileSelectionChange };
}
