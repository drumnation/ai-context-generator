import * as vscode from 'vscode';
import { logger } from '../../shared/logger';

export interface ProgressOptions {
  title: string;
  cancellable?: boolean;
  location?: vscode.ProgressLocation;
  initialProgress?: number;
}

export interface ProgressUpdate {
  message?: string;
  increment?: number;
  total?: number;
  current?: number;
}

interface ProgressTask {
  progress: vscode.Progress<{ message?: string; increment?: number }>;
  token: vscode.CancellationToken;
  options: ProgressOptions;
  currentProgress: number;
  total?: number;
}

export class ProgressService {
  private activeTasks: Map<string, ProgressTask> = new Map();

  async withProgress<T>(
    taskId: string,
    options: ProgressOptions,
    task: (
      progress: vscode.Progress<{ message?: string; increment?: number }>,
      token: vscode.CancellationToken,
    ) => Promise<T>,
  ): Promise<T> {
    const defaultOptions: ProgressOptions = {
      title: 'Processing...',
      cancellable: true,
      location: vscode.ProgressLocation.Notification,
      initialProgress: 0,
    };

    const mergedOptions = { ...defaultOptions, ...options };

    if (process.env.NODE_ENV === 'test') {
      const mockProgress = {
        report: (_value: { message?: string; increment?: number }) => {
          // Mock implementation for tests
        },
      };
      const mockToken = {
        isCancellationRequested: false,
        onCancellationRequested: () => ({ dispose: () => {} }),
      };
      return task(mockProgress, mockToken);
    }

    return vscode.window.withProgress(
      {
        location: mergedOptions.location!,
        title: mergedOptions.title,
        cancellable: mergedOptions.cancellable,
      },
      async (progress, token) => {
        try {
          this.activeTasks.set(taskId, {
            progress,
            token,
            options: mergedOptions,
            currentProgress: mergedOptions.initialProgress || 0,
          });

          const result = await task(progress, token);
          this.activeTasks.delete(taskId);
          return result;
        } catch (error) {
          this.activeTasks.delete(taskId);
          throw error;
        }
      },
    );
  }

  updateProgress(taskId: string, update: ProgressUpdate): void {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      logger.warn(`No active task found with ID: ${taskId}`);
      return;
    }

    if (update.total !== undefined) {
      task.total = update.total;
    }

    if (update.current !== undefined && task.total) {
      const newProgress = (update.current / task.total) * 100;
      const increment = newProgress - task.currentProgress;
      task.currentProgress = newProgress;
      task.progress.report({
        message: update.message,
        increment,
      });
    } else if (update.increment !== undefined) {
      task.currentProgress += update.increment;
      task.progress.report({
        message: update.message,
        increment: update.increment,
      });
    } else if (update.message) {
      task.progress.report({ message: update.message });
    }
  }

  cancelTask(taskId: string): void {
    const task = this.activeTasks.get(taskId);
    if (task && task.options.cancellable) {
      // VS Code's CancellationToken doesn't have a cancel method
      // The cancellation is handled through the token's event
      logger.info(`Task cancelled: ${taskId}`);
    }
  }

  isTaskActive(taskId: string): boolean {
    return this.activeTasks.has(taskId);
  }

  getTaskProgress(taskId: string): number | undefined {
    return this.activeTasks.get(taskId)?.currentProgress;
  }
}
