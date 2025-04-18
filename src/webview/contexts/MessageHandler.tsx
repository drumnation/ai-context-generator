import React, { createContext, useContext, useEffect, useRef } from 'react';
import {
  WebviewMessage,
  MessageAcknowledgment,
  HeartbeatMessage,
} from '../../shared/types';
import { logger } from '../../shared/logger';
import { vscode } from '../utils/vscode-api';
import { MessageBus, MessageSubscription } from '../../shared/MessageBus';

// Define the context type
export interface MessageHandlerContextType {
  sendMessage: <T extends WebviewMessage>(message: T) => Promise<void>;
  subscribe: <T extends WebviewMessage>(
    command: string,
    handler: (message: T) => void,
  ) => MessageSubscription;
}

// Create the context with a default undefined value
const MessageHandlerContext = createContext<
  MessageHandlerContextType | undefined
>(undefined);

/**
 * Type guard for HeartbeatMessage
 */
function isHeartbeatMessage(
  message: WebviewMessage,
): message is HeartbeatMessage {
  return message.command === 'heartbeat' && 'timestamp' in message;
}

/**
 * Custom message manager interface for the webview context
 * This is a simplified version of the MessageManager for use in webview
 */
interface WebviewMessageManager {
  state: string;
  registerEventHandlers: (handlers: Record<string, unknown>) => void;
  beginDisposal: () => void;
  handleAcknowledgment: (ack: MessageAcknowledgment) => void;
  sendMessage: (message: WebviewMessage) => Promise<void>;
}

/**
 * MessageHandler props
 */
interface MessageHandlerProps {
  children: React.ReactNode;
  // Optional prop to inject a message bus for testing
  messageBus?: MessageBus;
}

/**
 * WebviewMessageBus - adapts the MessageBus to work with webview communication
 * This is a simplified bridge between the vscode.postMessage API and our MessageBus
 */
class WebviewMessageBus {
  private messageBus: MessageBus | null = null;
  private isMounted = true;
  private activeListener: ((event: MessageEvent) => void) | null = null;

  /**
   * Initialize the message bus
   */
  initialize(): void {
    // Create a custom message bus for webview
    // We're not using the full MessageManager since we don't need panel management
    const customMessageBus: WebviewMessageManager = {
      state: 'ACTIVE',
      registerEventHandlers: () => {},
      beginDisposal: () => {},
      handleAcknowledgment: (ack: MessageAcknowledgment) => {
        logger.info(`[WebviewMessageBus] Handling ack: ${ack.id}`);
        if (this.messageBus) {
          // Instead of passing MessageAcknowledgment directly, convert it to a WebviewMessage
          // with the same properties, excluding command which will be replaced
          const { command, ...rest } = ack;
          const ackMessage: WebviewMessage = {
            command,
            ...rest,
          };
          this.messageBus.handleIncomingMessage(ackMessage, ack.id);
        }
      },
      sendMessage: async (message: WebviewMessage): Promise<void> => {
        if (!this.isMounted) {
          logger.warn('[WebviewMessageBus] Cannot send message, not mounted');
          return Promise.reject(new Error('Component not mounted'));
        }

        try {
          // In the webview context, we use vscode.postMessage directly
          logger.info(
            `[WebviewMessageBus] Posting message: ${message.command}`,
          );
          vscode.postMessage(message);
          return Promise.resolve();
        } catch (error) {
          logger.error(`[WebviewMessageBus] Error sending message: ${error}`);
          return Promise.reject(error);
        }
      },
    };

    // Create the MessageBus with our custom message manager
    // We need to cast this to get past the type checking
    this.messageBus = new MessageBus(customMessageBus as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    // Set up message listener
    this.setupMessageListener();

    // Send mounted signal to extension host
    this.sendMountedSignal();
  }

  /**
   * Setup message event listener
   */
  private setupMessageListener(): void {
    if (!this.isMounted) {
      return;
    }

    const messageListener = (event: MessageEvent) => {
      if (!this.isMounted || !this.messageBus) {
        logger.warn(
          '[WebviewMessageBus] Message received when not mounted or no bus available',
        );
        return;
      }

      logger.info(
        `[WebviewMessageBus] Received message: ${event.data?.command}`,
      );

      try {
        const message = event.data as WebviewMessage;

        // Special handling for heartbeat messages
        if (isHeartbeatMessage(message)) {
          this.handleHeartbeat();
          return;
        }

        // Route all other messages through the message bus
        this.messageBus.handleIncomingMessage(message);
      } catch (error) {
        logger.error('[WebviewMessageBus] Error processing message', { error });
      }
    };

    // Store the listener so we can remove it later
    this.activeListener = messageListener;

    // Add the event listener
    window.addEventListener('message', messageListener);
    logger.info('[WebviewMessageBus] Message event listener registered');
  }

  /**
   * Handle heartbeat messages separately
   */
  private handleHeartbeat(): void {
    // Respond to heartbeat with a pong
    try {
      logger.info('[WebviewMessageBus] Received heartbeat, sending pong');
      vscode.postMessage({ command: 'pong', timestamp: Date.now() });
    } catch (error) {
      logger.error('[WebviewMessageBus] Error sending pong', { error });
    }
  }

  /**
   * Send a message to indicate webview is mounted
   */
  private sendMountedSignal(): void {
    try {
      logger.info('[WebviewMessageBus] Sending webviewMounted signal');
      vscode.postMessage({ command: 'webviewMounted' });
    } catch (error) {
      logger.error('[WebviewMessageBus] Error sending mounted signal', {
        error,
      });
    }
  }

  /**
   * Clean up resources when unmounting
   */
  cleanup(): void {
    logger.info('[WebviewMessageBus] Cleaning up resources');
    this.isMounted = false;

    // Remove the message listener
    if (this.activeListener) {
      window.removeEventListener('message', this.activeListener);
      this.activeListener = null;
    }

    // Notify the extension host about unmounting
    try {
      logger.info('[WebviewMessageBus] Sending webviewUnmounting signal');
      vscode.postMessage({ command: 'webviewUnmounting' });
    } catch (error) {
      logger.error('[WebviewMessageBus] Error sending unmounting signal', {
        error,
      });
    }

    // Shut down the message bus
    if (this.messageBus) {
      this.messageBus.shutdown();
      this.messageBus = null;
    }
  }

  /**
   * Get the message bus instance
   */
  getMessageBus(): MessageBus | null {
    return this.messageBus;
  }
}

/**
 * MessageHandler Provider
 * Handles communication between webview and extension host
 */
export const MessageHandlerProvider: React.FC<MessageHandlerProps> = ({
  children,
  messageBus: injectedMessageBus,
}) => {
  // Create refs for tracking component lifecycle and message bus
  const isMounted = useRef(true);
  const webviewMessageBusRef = useRef<WebviewMessageBus | null>(null);
  const messageBusRef = useRef<MessageBus | null>(injectedMessageBus || null);

  // Initialize message handling on mount
  useEffect(() => {
    logger.info('[MessageHandler] Component mounting');

    if (!injectedMessageBus) {
      // Create and initialize the webview message bus
      const webviewMessageBus = new WebviewMessageBus();
      webviewMessageBus.initialize();
      webviewMessageBusRef.current = webviewMessageBus;

      // Store the message bus reference
      messageBusRef.current = webviewMessageBus.getMessageBus();
    }

    return () => {
      // Clean up on unmount
      logger.info('[MessageHandler] Component unmounting');
      isMounted.current = false;

      if (webviewMessageBusRef.current) {
        webviewMessageBusRef.current.cleanup();
        webviewMessageBusRef.current = null;
      }

      if (!injectedMessageBus) {
        messageBusRef.current = null;
      }
    };
  }, [injectedMessageBus]);

  // Method to send messages to the extension host
  const sendMessage = async <T extends WebviewMessage>(
    message: T,
  ): Promise<void> => {
    if (!isMounted.current || !messageBusRef.current) {
      logger.warn(
        '[MessageHandler] Cannot send message, not mounted or no message bus',
      );
      return Promise.reject(
        new Error('Component not mounted or message bus not available'),
      );
    }

    try {
      return await messageBusRef.current.dispatchMessage(message, false);
    } catch (error) {
      logger.error('[MessageHandler] Error sending message', { error });
      throw error;
    }
  };

  // Method to subscribe to specific message types
  const subscribe = <T extends WebviewMessage>(
    command: string,
    handler: (message: T) => void,
  ): MessageSubscription => {
    if (!messageBusRef.current) {
      logger.warn(
        '[MessageHandler] Cannot subscribe, no message bus available',
      );
      return { unsubscribe: () => {} };
    }

    return messageBusRef.current.subscribe<T>(
      command,
      (message, _messageId) => {
        if (isMounted.current) {
          handler(message as T);
        }
      },
    );
  };

  // Context value
  const contextValue: MessageHandlerContextType = {
    sendMessage,
    subscribe,
  };

  return (
    <MessageHandlerContext.Provider value={contextValue}>
      {children}
    </MessageHandlerContext.Provider>
  );
};

/**
 * Custom hook to access the MessageHandler context
 */
export const useMessageHandler = (): MessageHandlerContextType => {
  const context = useContext(MessageHandlerContext);

  if (!context) {
    throw new Error(
      'useMessageHandler must be used within a MessageHandlerProvider',
    );
  }

  return context;
};
