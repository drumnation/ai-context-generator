/* eslint-disable @typescript-eslint/no-explicit-any */

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

// Default log level (can be overridden)
let currentLogLevel = LogLevel.INFO;

/**
 * Enhanced logger with support for different log levels
 */
export const logger = {
  /**
   * Set the current log level. Messages below this level will not be logged.
   */
  setLogLevel(level: LogLevel): void {
    currentLogLevel = level;
  },

  /**
   * Get the current log level
   */
  getLogLevel(): LogLevel {
    return currentLogLevel;
  },

  /**
   * Debug level logging (most verbose)
   */
  debug(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Info level logging (normal operations)
   */
  info(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * Warning level logging (potential issues)
   */
  warn(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },

  /**
   * Error level logging (failures)
   */
  error(message: string, ...args: any[]): void {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  },
};
