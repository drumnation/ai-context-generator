import { useEffect, useCallback } from 'react';
import { vscode } from '../utils/vscode-api';
import { WebviewMessage } from '../../shared/types';
import { logger } from '../../shared/logger';

export function useVscodeMessaging(
  handleMessage: (message: WebviewMessage) => void,
) {
  const messageListener = useCallback(
    (event: MessageEvent) => {
      const message = event.data as WebviewMessage;
      logger.info('Received message in webview', message);
      handleMessage(message);
    },
    [handleMessage],
  );

  useEffect(() => {
    window.addEventListener('message', messageListener);
    vscode.postMessage({ command: 'checkRepoSize' });

    return () => window.removeEventListener('message', messageListener);
  }, [messageListener]);
}
