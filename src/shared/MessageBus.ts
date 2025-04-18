/**
 * MessageBus: A centralized messaging system for cross-component communication
 */
import { logger } from './logger';
import { WebviewMessage, MessageAcknowledgment } from './types';
import { MessageManager, MessageManagerState } from './communication';

/**
 * Type guard for MessageAcknowledgment
 */
function isAcknowledgmentMessage(
  message: WebviewMessage,
): message is WebviewMessage & MessageAcknowledgment {
  return (
    message.command === 'messageAck' &&
    'id' in message &&
    'status' in message &&
    typeof message.id === 'string' &&
    (message.status === 'success' || message.status === 'error')
  );
}

/**
 * Message handler function type
 */
export type MessageHandler<T extends WebviewMessage = WebviewMessage> = (
  message: T,
  messageId: string,
) => Promise<void> | void;

/**
 * Interface for MessageBus subscription
 */
export interface MessageSubscription {
  unsubscribe: () => void;
}

/**
 * MessageBus event types
 */
export enum MessageBusEventType {
  STATE_CHANGE = 'state_change',
  MESSAGE_RECEIVED = 'message_received',
  MESSAGE_SENT = 'message_sent',
  ACK_RECEIVED = 'ack_received',
  ERROR = 'error',
}

/**
 * Event data for different event types
 */
export interface MessageBusStateChangeEvent {
  oldState: MessageBusState;
  newState: MessageBusState;
}

export interface MessageBusMessageReceivedEvent {
  message: WebviewMessage;
  messageId: string;
}

export interface MessageBusMessageSentEvent {
  messageId: string;
  command: string;
}

export interface MessageBusAckReceivedEvent {
  messageId: string;
  success: boolean;
}

export interface MessageBusErrorEvent {
  error: Error;
  context: string;
}

export type MessageBusEvent =
  | MessageBusStateChangeEvent
  | MessageBusMessageReceivedEvent
  | MessageBusMessageSentEvent
  | MessageBusAckReceivedEvent
  | MessageBusErrorEvent;

/**
 * Message bus event handler
 */
export type MessageBusEventHandler = (event: MessageBusEvent) => void;

/**
 * MessageBus states
 */
export enum MessageBusState {
  INITIALIZING = 'initializing',
  READY = 'ready',
  PAUSED = 'paused',
  SHUTTING_DOWN = 'shutting_down',
  TERMINATED = 'terminated',
}

/**
 * A centralized bus for message routing and handling
 */
export class MessageBus {
  private state: MessageBusState = MessageBusState.INITIALIZING;
  private messageManager: MessageManager;
  private messageHandlers: Map<string, Set<MessageHandler<WebviewMessage>>> =
    new Map();
  private eventHandlers: Map<MessageBusEventType, Set<MessageBusEventHandler>> =
    new Map();
  private handlerIdCounter = 0;

  constructor(messageManager: MessageManager) {
    this.messageManager = messageManager;
    this.initializeMessageManager();
  }

  /**
   * Get the current state of the message bus
   */
  public getState(): MessageBusState {
    return this.state;
  }

  /**
   * Initialize the message manager with event handlers
   */
  private initializeMessageManager(): void {
    // Register event handlers
    this.messageManager.registerEventHandlers({
      onStateChange: this.handleManagerStateChange.bind(this),
      onMessageSent: this.handleMessageSent.bind(this),
      onAcknowledgmentReceived: this.handleAckReceived.bind(this),
      onHeartbeat: this.handleHeartbeat.bind(this),
      onError: this.handleError.bind(this),
    });

    // Set initial state based on message manager state
    this.updateStateFromManagerState(this.messageManager.state);
  }

  /**
   * Handle state changes from the message manager
   */
  private handleManagerStateChange(
    oldState: MessageManagerState,
    newState: MessageManagerState,
  ): void {
    logger.info(
      `[MessageBus] MessageManager state changed: ${oldState} -> ${newState}`,
    );
    this.updateStateFromManagerState(newState);
  }

  /**
   * Update the message bus state based on the message manager state
   */
  private updateStateFromManagerState(managerState: MessageManagerState): void {
    let newState: MessageBusState;

    switch (managerState) {
      case MessageManagerState.UNINITIALIZED:
        newState = MessageBusState.INITIALIZING;
        break;
      case MessageManagerState.ACTIVE:
        newState = MessageBusState.READY;
        break;
      case MessageManagerState.PAUSED:
        newState = MessageBusState.PAUSED;
        break;
      case MessageManagerState.DISPOSING:
        newState = MessageBusState.SHUTTING_DOWN;
        break;
      case MessageManagerState.DISPOSED:
        newState = MessageBusState.TERMINATED;
        break;
      default:
        newState = MessageBusState.INITIALIZING;
    }

    if (newState !== this.state) {
      const oldState = this.state;
      this.state = newState;
      this.emitEvent(MessageBusEventType.STATE_CHANGE, { oldState, newState });
    }
  }

  /**
   * Handle message sent event
   */
  private handleMessageSent(messageId: string, command: string): void {
    this.emitEvent(MessageBusEventType.MESSAGE_SENT, { messageId, command });
  }

  /**
   * Handle acknowledgment received event
   */
  private handleAckReceived(messageId: string, success: boolean): void {
    this.emitEvent(MessageBusEventType.ACK_RECEIVED, { messageId, success });
  }

  /**
   * Handle heartbeat event
   */
  private handleHeartbeat(): void {
    // Currently no action needed for heartbeats
  }

  /**
   * Handle error event
   */
  private handleError(error: Error, context: string): void {
    this.emitEvent(MessageBusEventType.ERROR, { error, context });
  }

  /**
   * Subscribe to a specific message command
   */
  public subscribe<T extends WebviewMessage>(
    command: string,
    handler: MessageHandler<T>,
  ): MessageSubscription {
    if (this.state === MessageBusState.TERMINATED) {
      logger.warn(
        `[MessageBus] Cannot subscribe to ${command} in terminated state`,
      );
      // Return a no-op subscription
      return { unsubscribe: () => {} };
    }

    // Create a unique ID for this handler
    const handlerId = this.generateHandlerId();

    // Get or create the handler set for this command
    if (!this.messageHandlers.has(command)) {
      this.messageHandlers.set(command, new Set());
    }

    // Type cast handler to WebviewMessage to make TS happy
    // This is safe since T extends WebviewMessage, and we'll only invoke with correct message types
    const genericHandler = ((message: WebviewMessage, messageId: string) => {
      // Since we register for specific command types, we can safely assume
      // the message is of type T when it's processed
      return handler(message as T, messageId);
    }) as MessageHandler<WebviewMessage>;

    // Add the handler
    const handlers = this.messageHandlers.get(command)!;
    handlers.add(genericHandler);

    logger.info(
      `[MessageBus] Subscribed to command: ${command} (handlerId: ${handlerId})`,
    );

    // Return unsubscribe function
    return {
      unsubscribe: () => {
        if (this.messageHandlers.has(command)) {
          const handlers = this.messageHandlers.get(command)!;
          handlers.delete(genericHandler);

          // Clean up if no more handlers for this command
          if (handlers.size === 0) {
            this.messageHandlers.delete(command);
          }

          logger.info(
            `[MessageBus] Unsubscribed from command: ${command} (handlerId: ${handlerId})`,
          );
        }
      },
    };
  }

  /**
   * Subscribe to message bus events
   */
  public on(
    eventType: MessageBusEventType,
    handler: MessageBusEventHandler,
  ): MessageSubscription {
    if (this.state === MessageBusState.TERMINATED) {
      logger.warn(
        `[MessageBus] Cannot subscribe to event ${eventType} in terminated state`,
      );
      // Return a no-op subscription
      return { unsubscribe: () => {} };
    }

    // Get or create the handler set for this event type
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }

    // Add the handler
    const handlers = this.eventHandlers.get(eventType)!;
    handlers.add(handler);

    logger.info(`[MessageBus] Subscribed to event: ${eventType}`);

    // Return unsubscribe function
    return {
      unsubscribe: () => {
        if (this.eventHandlers.has(eventType)) {
          const handlers = this.eventHandlers.get(eventType)!;
          handlers.delete(handler);

          // Clean up if no more handlers for this event
          if (handlers.size === 0) {
            this.eventHandlers.delete(eventType);
          }

          logger.info(`[MessageBus] Unsubscribed from event: ${eventType}`);
        }
      },
    };
  }

  /**
   * Emit an event to all subscribers
   */
  private emitEvent(
    eventType: MessageBusEventType,
    eventData: MessageBusEvent,
  ): void {
    if (!this.eventHandlers.has(eventType)) {
      return;
    }

    const handlers = this.eventHandlers.get(eventType)!;

    for (const handler of handlers) {
      try {
        handler(eventData);
      } catch (error) {
        logger.error(`[MessageBus] Error in event handler for ${eventType}`, {
          error,
        });
      }
    }
  }

  /**
   * Dispatch a message to the webview
   */
  public async dispatchMessage<T extends WebviewMessage>(
    message: T,
    requiresAck = true,
    timeoutMs?: number,
  ): Promise<void> {
    if (
      this.state === MessageBusState.TERMINATED ||
      this.state === MessageBusState.SHUTTING_DOWN
    ) {
      throw new Error(`Cannot dispatch message in ${this.state} state`);
    }

    logger.info(`[MessageBus] Dispatching message: ${message.command}`);
    return this.messageManager.sendMessage(message, requiresAck, timeoutMs);
  }

  /**
   * Handle an incoming message from the webview
   */
  public handleIncomingMessage(
    message: WebviewMessage,
    messageId: string = 'direct',
  ): void {
    // Skip handling in terminated or shutting down state
    if (
      this.state === MessageBusState.TERMINATED ||
      this.state === MessageBusState.SHUTTING_DOWN
    ) {
      logger.warn(`[MessageBus] Ignoring message in ${this.state} state`);
      return;
    }

    logger.info(
      `[MessageBus] Received message: ${message.command} (id: ${messageId})`,
    );

    // Emit the message received event
    this.emitEvent(MessageBusEventType.MESSAGE_RECEIVED, {
      message,
      messageId,
    });

    // Handle special message types
    if (message.command === 'messageAck') {
      // Use the type guard to ensure message is a valid MessageAcknowledgment
      if (isAcknowledgmentMessage(message)) {
        this.handleAcknowledgmentMessage(message);
      } else {
        logger.error(`[MessageBus] Received invalid messageAck format`, {
          message,
        });
      }
      return;
    }

    // Find handlers for this command
    const handlers = this.messageHandlers.get(message.command);

    if (!handlers || handlers.size === 0) {
      logger.warn(
        `[MessageBus] No handlers registered for command: ${message.command}`,
      );
      return;
    }

    // Execute all handlers
    for (const handler of handlers) {
      try {
        const result = handler(message, messageId);

        // If the handler returns a promise, catch any errors
        if (result instanceof Promise) {
          result.catch((error) => {
            logger.error(
              `[MessageBus] Error in async handler for ${message.command}`,
              { error },
            );
          });
        }
      } catch (error) {
        logger.error(`[MessageBus] Error in handler for ${message.command}`, {
          error,
        });
      }
    }
  }

  /**
   * Handle an acknowledgment message
   */
  private handleAcknowledgmentMessage(ack: MessageAcknowledgment): void {
    this.messageManager.handleAcknowledgment(ack);
  }

  /**
   * Pause message bus operations
   */
  public pause(): void {
    if (this.state === MessageBusState.READY) {
      this.messageManager.pause();
      this.state = MessageBusState.PAUSED;
      this.emitEvent(MessageBusEventType.STATE_CHANGE, {
        oldState: MessageBusState.READY,
        newState: MessageBusState.PAUSED,
      });
    }
  }

  /**
   * Resume message bus operations
   */
  public resume(): void {
    if (this.state === MessageBusState.PAUSED) {
      this.messageManager.resume();
      this.state = MessageBusState.READY;
      this.emitEvent(MessageBusEventType.STATE_CHANGE, {
        oldState: MessageBusState.PAUSED,
        newState: MessageBusState.READY,
      });
    }
  }

  /**
   * Shut down the message bus
   */
  public shutdown(): void {
    if (this.state === MessageBusState.TERMINATED) {
      return; // Already terminated
    }

    logger.info('[MessageBus] Shutting down...');

    // Update state
    const oldState = this.state;
    this.state = MessageBusState.SHUTTING_DOWN;
    this.emitEvent(MessageBusEventType.STATE_CHANGE, {
      oldState,
      newState: MessageBusState.SHUTTING_DOWN,
    });

    // Begin message manager disposal
    this.messageManager.beginDisposal();

    // Clear all handlers
    this.messageHandlers.clear();
    this.eventHandlers.clear();

    // Update state to terminated
    this.state = MessageBusState.TERMINATED;
    this.emitEvent(MessageBusEventType.STATE_CHANGE, {
      oldState: MessageBusState.SHUTTING_DOWN,
      newState: MessageBusState.TERMINATED,
    });

    logger.info('[MessageBus] Shutdown complete');
  }

  /**
   * Generate a unique handler ID
   */
  private generateHandlerId(): string {
    return `handler-${++this.handlerIdCounter}`;
  }
}
