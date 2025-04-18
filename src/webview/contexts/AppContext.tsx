import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { useAppState } from '../hooks/useAppState';
import { vscode } from '../utils/vscode-api';
import {
  WebviewMessage,
  UpdateContentMessage,
  RepoSizeResultMessage,
  AppState,
  MessageEnvelope,
  MessageAcknowledgment,
  HeartbeatMessage,
} from '../../shared/types';
import { logger } from '../../shared/logger';

// Global reference to prevent message handling after unmount
// This is a radical solution to ensure no messages are processed after unmount
let isWebviewActive = false;
let activeListener: ((event: MessageEvent) => void) | null = null;

export interface AppContextType {
  state: AppState;
  setFileTree: (fileTree: string) => void;
  setCombinedContent: (content: string) => void;
  setError: (error: boolean) => void;
  setLoading: (loading: boolean) => void;
  setFileSelections: (selections: { [key: string]: boolean }) => void;
  setIsRoot: (isRoot: boolean) => void;
  setMode: (mode: 'directory' | 'root') => void;
  setAllFilesChecked: (checked: boolean) => void;
  setIsLargeRepo: (isLarge: boolean) => void;
  handleModeChange: (mode: 'directory' | 'root') => void;
  handleToggleFiles: (checked: boolean) => void;
  handleFileSelectionChange: (selections: { [key: string]: boolean }) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function isUpdateContentMessage(
  message: WebviewMessage,
): message is UpdateContentMessage {
  return message.command === 'updateContent' && 'fileTree' in message;
}

function isRepoSizeResultMessage(
  message: WebviewMessage,
): message is RepoSizeResultMessage {
  return message.command === 'repoSizeResult' && 'isLarge' in message;
}

function isHeartbeatMessage(
  message: WebviewMessage,
): message is HeartbeatMessage {
  return message.command === 'heartbeat' && 'timestamp' in message;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    state,
    setFileTree,
    setCombinedContent,
    setError,
    setLoading,
    setIsRoot,
    setMode,
    setIsLargeRepo,
  } = useAppState();

  // Keep track of component mounted state to avoid operations after unmounting
  const isMounted = useRef(true);
  const pendingOperations = useRef<Set<string>>(new Set());

  // Cleanup on unmount
  useEffect(() => {
    // Mark webview as active globally
    isWebviewActive = true;

    // Send mounted message
    try {
      logger.info(
        'AppContext: Component mounted, sending webviewMounted message',
      );
      vscode.postMessage({ command: 'webviewMounted' });
    } catch (error) {
      logger.error(
        `AppContext: Error sending mounted message: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return () => {
      // CRITICAL: Set global flag first to prevent any new messages from being processed
      isWebviewActive = false;

      // CRITICAL: Remove the global message listener immediately
      if (activeListener) {
        logger.info(
          'AppContext: EMERGENCY - Removing message listener before any other cleanup',
        );
        window.removeEventListener('message', activeListener);
        activeListener = null;
      }

      // Then proceed with regular unmount sequence
      isMounted.current = false;
      logger.info('AppContext: Component unmounting, cleaning up');

      // Get pending operations before cleanup
      const pendingOps = Array.from(pendingOperations.current);
      logger.info(
        `AppContext: Unmounting with ${pendingOps.length} pending operations`,
      );

      // Notify extension host about unmounting with any pending operation IDs
      try {
        logger.info(
          `AppContext: Sending webviewUnmounting message with ${pendingOps.length} pending operations`,
        );
        vscode.postMessage({
          command: 'webviewUnmounting',
          pendingOperations: pendingOps,
        });
      } catch (error) {
        logger.error(
          `AppContext: Error sending unmounting message: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Clear any pending operations on unmount
      pendingOperations.current.clear();
    };
  }, []);

  /**
   * Send acknowledgment for a received message
   */
  const sendAcknowledgment = useCallback(
    (messageId: string, success = true, error?: string) => {
      if (!isMounted.current) {
        logger.warn(
          `AppContext: Can't send ack for ${messageId}, component unmounted`,
        );
        return;
      }

      try {
        const ack: MessageAcknowledgment = {
          command: 'messageAck',
          id: messageId,
          status: success ? 'success' : 'error',
          error,
        };

        logger.info(
          `AppContext: Posting acknowledgment for message ${messageId} at ${Date.now()}`,
        );
        vscode.postMessage(ack);
      } catch (error) {
        logger.error(
          `AppContext: Error sending acknowledgment: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [], // No dependencies needed, isMounted.current covers lifecycle
  );

  const handleMessagePayload = useCallback(
    (message: WebviewMessage, envelopeId?: string, requiresAck = false) => {
      logger.info(
        `AppContext: Handling message: ${message.command} ${envelopeId ? '(envelope: ' + envelopeId + ')' : ''} at ${Date.now()}`,
      );

      try {
        switch (message.command) {
          case 'processingStarted': {
            logger.info('AppContext: Handling processingStarted', message);
            setLoading(true);
            setError(false);
            if (envelopeId && requiresAck) {
              logger.info(
                `AppContext: Calling sendAcknowledgment for processingStarted envelope ${envelopeId} at ${Date.now()}`,
              );
              sendAcknowledgment(envelopeId, true);
            }
            break;
          }
          case 'updateContent': {
            if (isUpdateContentMessage(message)) {
              logger.info('AppContext: Handling updateContent', message);
              setFileTree(message.fileTree);
              setCombinedContent(message.combinedContent);
              setError(false);
              setLoading(false);
              setIsRoot(message.isRoot);
              setMode(message.mode);

              if (envelopeId && requiresAck) {
                sendAcknowledgment(envelopeId, true);
              }
            } else {
              logger.warn(
                'AppContext: Received invalid updateContent message',
                message,
              );

              if (envelopeId && requiresAck) {
                sendAcknowledgment(
                  envelopeId,
                  false,
                  'Invalid updateContent message format',
                );
              }
            }
            break;
          }
          case 'updateFileTree': {
            logger.info('AppContext: Handling updateFileTree', message);
            // Explicitly cast message to include operationId
            const updateTreeMessage = message as WebviewMessage & {
              operationId?: string;
              fileTree: string;
              isRoot: boolean;
              mode: string;
            };

            logger.info(
              `AppContext: updateFileTree message details - operationId: ${updateTreeMessage.operationId}, fileTree length: ${updateTreeMessage.fileTree.length}, isRoot: ${updateTreeMessage.isRoot}, mode: ${updateTreeMessage.mode}`,
            );

            setFileTree(updateTreeMessage.fileTree);
            setLoading(false);
            setIsRoot(updateTreeMessage.isRoot);
            setMode(updateTreeMessage.mode as 'directory' | 'root'); // Cast mode
            setError(false);

            // Send acknowledgement back to the backend including the operationId
            if (updateTreeMessage.operationId) {
              logger.info(
                `AppContext: Sending fileTreeReceived acknowledgement for operation ${updateTreeMessage.operationId} at ${Date.now()}`,
              );
              try {
                vscode.postMessage({
                  command: 'fileTreeReceived',
                  operationId: updateTreeMessage.operationId,
                });
              } catch (error) {
                logger.error(
                  `AppContext: Error sending fileTreeReceived acknowledgment: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            } else {
              logger.warn(
                'AppContext: updateFileTree received without operationId, cannot send ack.',
              );
            }

            // Also send envelope ack if needed
            if (envelopeId && requiresAck) {
              sendAcknowledgment(envelopeId, true);
            }

            break;
          }
          case 'showError': {
            logger.error('AppContext: Handling showError');
            setError(true);
            setLoading(false);

            if (envelopeId && requiresAck) {
              sendAcknowledgment(envelopeId, true);
            }
            break;
          }
          case 'heartbeat': {
            // Handle the heartbeat from backend
            if (isHeartbeatMessage(message)) {
              // Use logger.info instead of logger.debug
              logger.info(
                `AppContext: Received heartbeat from backend at ${Date.now()}.`,
              );
              // Send a heartbeat response back
              try {
                logger.info(
                  `AppContext: Sending heartbeatResponse at ${Date.now()}.`,
                );
                vscode.postMessage({
                  command: 'heartbeatResponse',
                  timestamp: Date.now(),
                });
              } catch (error) {
                logger.error(
                  `AppContext: Error sending heartbeat response: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            }
            break;
          }
          case 'ping': {
            // Handle the ping from backend
            logger.info('AppContext: Received ping from backend.');
            // Send a pong back to confirm communication
            try {
              vscode.postMessage({ command: 'pong' });
            } catch (error) {
              logger.error(
                `AppContext: Error sending pong response: ${error instanceof Error ? error.message : String(error)}`,
              );
            }

            if (envelopeId && requiresAck) {
              sendAcknowledgment(envelopeId, true);
            }
            break;
          }
          case 'pong': {
            // Handle the pong response from backend
            logger.info(
              'AppContext: Received pong from backend - communication verified.',
            );

            if (envelopeId && requiresAck) {
              sendAcknowledgment(envelopeId, true);
            }
            break;
          }
          case 'repoSizeResult':
            if (isRepoSizeResultMessage(message)) {
              logger.info(
                `AppContext: Handling repoSizeResult: ${message.isLarge}`,
              );
              setIsLargeRepo(message.isLarge);

              if (envelopeId && requiresAck) {
                sendAcknowledgment(envelopeId, true);
              }
            } else {
              logger.warn(
                'AppContext: Received invalid repoSizeResult message',
              );

              if (envelopeId && requiresAck) {
                sendAcknowledgment(
                  envelopeId,
                  false,
                  'Invalid repoSizeResult message format',
                );
              }
            }
            break;
          default:
            logger.warn(
              `AppContext: Unknown message command received: ${message.command}`,
            );

            if (envelopeId && requiresAck) {
              sendAcknowledgment(
                envelopeId,
                false,
                `Unknown command: ${message.command}`,
              );
            }
        }
      } catch (error) {
        logger.error('AppContext: Error processing message:', {
          error,
          message,
        });

        if (envelopeId && requiresAck) {
          sendAcknowledgment(
            envelopeId,
            false,
            `Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }
    },
    // State setters are stable and don't need to be dependencies here
    [
      sendAcknowledgment,
      setCombinedContent,
      setError,
      setFileTree,
      setIsLargeRepo,
      setIsRoot,
      setLoading,
      setMode,
    ],
  );

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // CRITICAL: Check the global flag first, before any processing
      if (!isWebviewActive) {
        logger.warn(
          `AppContext: BLOCKED - Message received after webview deactivation, completely ignoring`,
        );
        return;
      }

      const data = event.data;

      // Skip processing if component is unmounting or unmounted
      if (!isMounted.current) {
        logger.warn(
          `AppContext: Message received after unmount at ${Date.now()}, ignoring:`,
          data,
        );
        return;
      }

      logger.info(
        `>>> AppContext: Raw message event received at ${Date.now()}:`,
        data,
      );

      // Handle message envelopes
      if (
        data &&
        typeof data === 'object' &&
        'id' in data &&
        'payload' in data
      ) {
        // This is an envelope
        const envelope = data as MessageEnvelope<WebviewMessage>;
        logger.info(
          `AppContext: Processing envelope ${envelope.id}, command: ${envelope.payload.command} at ${Date.now()}`,
        );

        // Skip if unmounted (double-check)
        if (!isMounted.current) {
          logger.warn(
            `AppContext: Skipping envelope ${envelope.id} processing due to unmount`,
          );
          return;
        }

        // Track operation ID if this requires acknowledgment
        if (envelope.requiresAck) {
          pendingOperations.current.add(envelope.id);
        }

        // Process the actual message payload
        handleMessagePayload(
          envelope.payload,
          envelope.id,
          envelope.requiresAck,
        );

        // Clean up tracking if needed
        if (envelope.requiresAck) {
          pendingOperations.current.delete(envelope.id);
        }
      } else {
        // Skip if unmounted (double-check)
        if (!isMounted.current) {
          logger.warn(
            `AppContext: Skipping direct message processing due to unmount`,
          );
          return;
        }

        // Legacy direct message handling
        const message = data as WebviewMessage;
        handleMessagePayload(message);
      }
    },
    [handleMessagePayload],
  );

  useEffect(() => {
    const messageListener = (event: MessageEvent) => {
      // CRITICAL: Check global flag before any processing
      if (!isWebviewActive) {
        logger.warn(
          'AppContext: BLOCKED - Message listener executed after deactivation',
        );
        return;
      }

      logger.info(
        `AppContext: Received message event at ${Date.now()} - ID: ${event.data?.id}, Command: ${event.data?.payload?.command}`,
      );
      handleMessage(event);
    };

    // Store the listener in the global reference
    activeListener = messageListener;

    logger.info('AppContext: Setting up message event listener');
    window.addEventListener('message', messageListener);

    // Send a ping to the backend to verify communication channel
    try {
      logger.info(
        'AppContext: Sending initial ping to verify communication channel',
      );
      vscode.postMessage({ command: 'ping' });
    } catch (error) {
      logger.error(
        `AppContext: Error sending initial ping: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return () => {
      // NOTE: This cleanup might never run if we're already removing the listener in the earlier effect
      // This is intentional redundancy for extra safety
      logger.info(
        'AppContext: Secondary cleanup - removing message event listener',
      );
      if (activeListener === messageListener) {
        window.removeEventListener('message', messageListener);
        activeListener = null;
      }
    };
  }, [handleMessage]); // Depend on the stable handleMessage wrapper

  useEffect(() => {
    // Use logger.info instead of logger.debug
    logger.info('AppContext state changed:', state);
  }, [state]);

  return (
    <AppContext.Provider value={{ ...useAppState() }}>
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
