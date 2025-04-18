/**
 * Communication utilities for reliable message exchange between extension and webview
 */
import * as vscode from 'vscode';
import { logger } from './logger';
import {
  MessageEnvelope,
  WebviewMessage,
  MessageAcknowledgment,
} from './types';

/**
 * States for the message manager state machine
 */
export enum MessageManagerState {
  UNINITIALIZED = 'UNINITIALIZED', // Initial state, no panel set
  ACTIVE = 'ACTIVE', // Panel is set and ready for communication
  PAUSED = 'PAUSED', // Temporarily paused (e.g., during heavy operations)
  DISPOSING = 'DISPOSING', // In the process of being disposed
  DISPOSED = 'DISPOSED', // Fully disposed, no communication possible
}

interface PendingMessageInfo {
  id: string;
  resolve: () => void;
  reject: (reason?: unknown) => void;
  timeout: NodeJS.Timeout;
  timestamp: number;
  command: string;
}

/**
 * Event emitter interface for MessageManager events
 */
export interface MessageManagerEvents {
  onStateChange: (
    oldState: MessageManagerState,
    newState: MessageManagerState,
  ) => void;
  onMessageSent: (messageId: string, command: string) => void;
  onAcknowledgmentReceived: (messageId: string, success: boolean) => void;
  onHeartbeat: () => void;
  onError: (error: Error, context: string) => void;
}

/**
 * Manages message communication with acknowledgments and timeouts
 */
export class MessageManager {
  private pendingMessages = new Map<string, PendingMessageInfo>();
  private webviewPanel: vscode.WebviewPanel | undefined;
  private lastHeartbeat = Date.now();
  private heartbeatInterval: NodeJS.Timeout | undefined;
  private heartbeatIntervalMs = 5000;
  private defaultTimeoutMs = 60000;

  // State management
  private currentState: MessageManagerState = MessageManagerState.UNINITIALIZED;
  private eventHandlers: Partial<MessageManagerEvents> = {};

  constructor(private operationPrefix: string) {}

  /**
   * Get the current state of the message manager
   */
  public get state(): MessageManagerState {
    return this.currentState;
  }

  /**
   * Register event handlers
   */
  public registerEventHandlers(handlers: Partial<MessageManagerEvents>): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Transition to a new state and emit the state change event
   */
  private transitionTo(newState: MessageManagerState): void {
    const oldState = this.currentState;

    if (oldState === newState) {
      return; // No transition needed
    }

    logger.info(
      `[MessageManager] State transition: ${oldState} -> ${newState}`,
    );
    this.currentState = newState;

    // Emit state change event
    if (this.eventHandlers.onStateChange) {
      try {
        this.eventHandlers.onStateChange(oldState, newState);
      } catch (error) {
        logger.error('[MessageManager] Error in state change handler', {
          error,
        });
      }
    }
  }

  /**
   * Set the webview panel for communications
   */
  setWebviewPanel(panel: vscode.WebviewPanel) {
    if (this.currentState === MessageManagerState.DISPOSED) {
      logger.warn('[MessageManager] Attempted to set panel after disposal');
      return;
    }

    this.webviewPanel = panel;
    this.transitionTo(MessageManagerState.ACTIVE);
    this.setupHeartbeat();
  }

  /**
   * Pause message processing (will still queue messages)
   */
  pause(): void {
    if (this.currentState === MessageManagerState.ACTIVE) {
      this.transitionTo(MessageManagerState.PAUSED);
    }
  }

  /**
   * Resume message processing
   */
  resume(): void {
    if (this.currentState === MessageManagerState.PAUSED) {
      this.transitionTo(MessageManagerState.ACTIVE);
    }
  }

  /**
   * Begin the disposal process
   */
  beginDisposal(): void {
    if (this.currentState === MessageManagerState.DISPOSED) {
      return; // Already disposed
    }

    this.transitionTo(MessageManagerState.DISPOSING);
    this.cleanupPendingOperations();
  }

  /**
   * Clear the webview panel reference
   */
  clearWebviewPanel() {
    this.beginDisposal();
    this.webviewPanel = undefined;
    this.clearHeartbeat();
    this.transitionTo(MessageManagerState.DISPOSED);
  }

  /**
   * Check if panel is valid and available
   */
  private isPanelValid(): boolean {
    if (
      this.currentState === MessageManagerState.DISPOSED ||
      this.currentState === MessageManagerState.DISPOSING ||
      !this.webviewPanel
    ) {
      return false;
    }

    try {
      // Basic test - see if we can access the webview
      const _ = this.webviewPanel.webview;
      return true;
    } catch (err) {
      logger.error('[MessageManager] Panel is no longer valid', { error: err });
      // Auto-cleanup if we detect an invalid panel
      this.beginDisposal();
      this.clearWebviewPanel();
      return false;
    }
  }

  /**
   * Send a message to the webview with acknowledgment tracking
   */
  async sendMessage<T extends WebviewMessage>(
    message: T,
    requiresAck = true,
    timeoutMs = this.defaultTimeoutMs,
  ): Promise<void> {
    // Check if we can send messages in the current state
    if (
      this.currentState === MessageManagerState.DISPOSED ||
      this.currentState === MessageManagerState.DISPOSING
    ) {
      throw new Error(`Cannot send message in ${this.currentState} state`);
    }

    if (!this.isPanelValid()) {
      throw new Error('No webview panel available for communication');
    }

    const messageId = `${this.operationPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    const envelope: MessageEnvelope<T> = {
      id: messageId,
      timestamp: Date.now(),
      payload: message,
      requiresAck,
    };

    // If ack is required, set up promise and timeout
    if (requiresAck) {
      logger.info(
        `[MessageManager] Sending message ${messageId} (command: ${message.command}) requiring ack with timeout ${timeoutMs}ms`,
      );
      const messagePromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (this.pendingMessages.has(messageId)) {
            logger.error(
              `[MessageManager] Timeout waiting for acknowledgment of message ${messageId}`,
            );
            logger.info(
              `[MessageManager] Timeout fired for ${messageId} at ${Date.now()}`,
            );
            this.pendingMessages.delete(messageId);

            const timeoutError = new Error(
              `Timeout waiting for message acknowledgment: ${message.command}`,
            );

            // Emit error event
            if (this.eventHandlers.onError) {
              try {
                this.eventHandlers.onError(
                  timeoutError,
                  `Message timeout: ${messageId}`,
                );
              } catch (error) {
                logger.error('[MessageManager] Error in error handler', {
                  error,
                });
              }
            }

            reject(timeoutError);
          }
        }, timeoutMs);

        this.pendingMessages.set(messageId, {
          id: messageId,
          resolve,
          reject,
          timeout,
          timestamp: Date.now(),
          command: message.command,
        });
      });

      // Final check before sending
      if (!this.isPanelValid()) {
        this.pendingMessages.delete(messageId);
        throw new Error('Panel became invalid during send preparation');
      }

      // Send message first, then await response
      logger.info(
        `[MessageManager] Posting message ${messageId} with timeout ${timeoutMs}ms at ${Date.now()}`,
      );

      try {
        await this.webviewPanel!.webview.postMessage(envelope);

        // Emit message sent event
        if (this.eventHandlers.onMessageSent) {
          try {
            this.eventHandlers.onMessageSent(messageId, message.command);
          } catch (error) {
            logger.error('[MessageManager] Error in message sent handler', {
              error,
            });
          }
        }
      } catch (error) {
        // If send fails, clean up and rethrow
        logger.error(`[MessageManager] Error sending message ${messageId}`, {
          error,
        });
        if (this.pendingMessages.has(messageId)) {
          const pendingInfo = this.pendingMessages.get(messageId)!;
          clearTimeout(pendingInfo.timeout);
          this.pendingMessages.delete(messageId);
        }

        // Emit error event
        if (this.eventHandlers.onError) {
          try {
            this.eventHandlers.onError(
              error instanceof Error ? error : new Error(String(error)),
              `Sending message ${messageId}`,
            );
          } catch (handlerError) {
            logger.error('[MessageManager] Error in error handler', {
              error: handlerError,
            });
          }
        }

        throw error;
      }

      return messagePromise;
    } else {
      logger.info(
        `[MessageManager] Sending message ${messageId} (command: ${message.command}) without requiring ack`,
      );

      // Final check before sending
      if (!this.isPanelValid()) {
        throw new Error('Panel became invalid during send preparation');
      }

      // No ack required, just send
      try {
        await this.webviewPanel!.webview.postMessage(envelope);

        // Emit message sent event
        if (this.eventHandlers.onMessageSent) {
          try {
            this.eventHandlers.onMessageSent(messageId, message.command);
          } catch (error) {
            logger.error('[MessageManager] Error in message sent handler', {
              error,
            });
          }
        }
      } catch (error) {
        logger.error(`[MessageManager] Error sending message ${messageId}`, {
          error,
        });

        // Emit error event
        if (this.eventHandlers.onError) {
          try {
            this.eventHandlers.onError(
              error instanceof Error ? error : new Error(String(error)),
              `Sending message ${messageId}`,
            );
          } catch (handlerError) {
            logger.error('[MessageManager] Error in error handler', {
              error: handlerError,
            });
          }
        }

        throw error;
      }
      return;
    }
  }

  /**
   * Handle acknowledgment from webview
   */
  handleAcknowledgment(ack: MessageAcknowledgment) {
    if (this.currentState === MessageManagerState.DISPOSED) {
      logger.warn(
        `[MessageManager] Acknowledgment ${ack.id} received after disposal, ignoring`,
      );
      return;
    }

    logger.info(
      `[MessageManager] handleAcknowledgment ENTERED for ID: ${ack.id} at ${Date.now()}`,
    );
    const pendingInfo = this.pendingMessages.get(ack.id);

    if (pendingInfo) {
      logger.info(
        `[MessageManager] Found pending message for ${ack.id}, clearing timeout.`,
      );
      clearTimeout(pendingInfo.timeout);

      if (ack.status === 'success') {
        pendingInfo.resolve();
      } else {
        pendingInfo.reject(
          new Error(ack.error || 'Unknown error in message acknowledgment'),
        );
      }

      this.pendingMessages.delete(ack.id);
      logger.info(
        `[MessageManager] Successfully processed acknowledgment for message ${ack.id}`,
      );

      // Emit acknowledgment received event
      if (this.eventHandlers.onAcknowledgmentReceived) {
        try {
          this.eventHandlers.onAcknowledgmentReceived(
            ack.id,
            ack.status === 'success',
          );
        } catch (error) {
          logger.error('[MessageManager] Error in acknowledgment handler', {
            error,
          });
        }
      }
    } else {
      logger.warn(
        `[MessageManager] Received acknowledgment for unknown or timed out message ${ack.id}`,
      );
    }
  }

  /**
   * Calculate timeout based on project size
   */
  calculateTimeout(fileCount: number): number {
    // Base timeout plus additional time per X files
    return Math.min(
      30000 + Math.floor(fileCount / 100) * 5000,
      120000, // Cap at 2 minutes
    );
  }

  /**
   * Setup heartbeat monitoring
   */
  private setupHeartbeat() {
    this.clearHeartbeat();
    logger.info('[MessageManager] Setting up heartbeat interval.');

    this.heartbeatInterval = setInterval(() => {
      if (
        this.currentState === MessageManagerState.DISPOSED ||
        this.currentState === MessageManagerState.DISPOSING ||
        !this.isPanelValid()
      ) {
        this.clearHeartbeat();
        return;
      }

      // Check if webview is responsive
      const now = Date.now();
      if (now - this.lastHeartbeat > this.heartbeatIntervalMs * 2) {
        logger.warn(
          `[MessageManager] Webview heartbeat missed (last: ${this.lastHeartbeat}, now: ${now}), panel may be unresponsive`,
        );
      }

      // Send heartbeat message
      try {
        this.webviewPanel!.webview.postMessage({
          command: 'heartbeat',
          timestamp: now,
        });
      } catch (error) {
        logger.error('[MessageManager] Error sending heartbeat', { error });
        // Don't invalidate panel just for a heartbeat failure
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Update heartbeat timestamp
   */
  updateHeartbeat() {
    if (this.currentState === MessageManagerState.DISPOSED) {
      logger.warn(
        '[MessageManager] Heartbeat update received after disposal, ignoring',
      );
      return;
    }

    const now = Date.now();
    logger.info(
      `[MessageManager] Heartbeat response received, updating lastHeartbeat to ${now}`,
    );
    this.lastHeartbeat = now;

    // Emit heartbeat event
    if (this.eventHandlers.onHeartbeat) {
      try {
        this.eventHandlers.onHeartbeat();
      } catch (error) {
        logger.error('[MessageManager] Error in heartbeat handler', { error });
      }
    }
  }

  /**
   * Clear heartbeat interval
   */
  private clearHeartbeat() {
    if (this.heartbeatInterval) {
      logger.info('[MessageManager] Clearing heartbeat interval');
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  /**
   * Clean up all pending operations
   */
  cleanupPendingOperations() {
    if (this.pendingMessages.size === 0) {
      logger.info('[MessageManager] No pending messages to clean up');
      return;
    }

    logger.info(
      `[MessageManager] Cleaning up ${this.pendingMessages.size} pending operations`,
    );

    // Reject all pending promises with a specific error message
    for (const [id, info] of this.pendingMessages.entries()) {
      logger.info(`[MessageManager] Cleaning up pending message: ${id}`);
      clearTimeout(info.timeout);
      const error = new Error(
        'Operation canceled: webview communication channel closed',
      );
      info.reject(error);
    }

    // Clear the map
    this.pendingMessages.clear();
  }

  /**
   * Get all pending message IDs
   */
  getPendingMessageIds(): string[] {
    return Array.from(this.pendingMessages.keys());
  }

  /**
   * Get information about all pending messages
   */
  getPendingMessagesInfo(): Array<{
    id: string;
    command: string;
    timestamp: number;
  }> {
    return Array.from(this.pendingMessages.values()).map((info) => ({
      id: info.id,
      command: info.command,
      timestamp: info.timestamp,
    }));
  }

  /**
   * Execute an operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryCount = 3,
    delayMs = 1000,
  ): Promise<T> {
    let lastError: unknown;
    let attemptsRemaining = retryCount;

    while (attemptsRemaining > 0) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        attemptsRemaining--;

        if (attemptsRemaining === 0) {
          break;
        }

        // Wait before retrying
        logger.info(
          `[MessageManager] Operation failed, retrying in ${delayMs}ms (${attemptsRemaining} attempts remaining)`,
          { error },
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    logger.error('[MessageManager] Operation failed after retries', {
      error: lastError,
    });
    throw lastError;
  }
}
