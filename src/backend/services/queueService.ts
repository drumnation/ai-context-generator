import * as vscode from 'vscode';
import { logger } from '../../shared/logger';

export interface QueueItem<T> {
  data: T;
  priority: number;
}

export interface ProcessingOptions {
  chunkSize: number;
  delayBetweenChunks: number;
  cancelToken?: vscode.CancellationToken;
}

export class QueueService {
  private queue: QueueItem<unknown>[] = [];
  private isProcessing = false;
  private currentProgress:
    | vscode.Progress<{ message?: string; increment?: number }>
    | undefined;

  async enqueue<T>(item: T, priority: number = 0): Promise<void> {
    this.queue.push({ data: item, priority });
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  async processChunked<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: ProcessingOptions,
  ): Promise<R[]> {
    const results: R[] = [];
    const chunks = this.chunkArray(items, options.chunkSize);
    let processedCount = 0;
    const totalItems = items.length;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Processing files...',
        cancellable: true,
      },
      async (progress, token) => {
        this.currentProgress = progress;

        for (const chunk of chunks) {
          if (
            token.isCancellationRequested ||
            options.cancelToken?.isCancellationRequested
          ) {
            logger.info('Processing cancelled by user');
            break;
          }

          const chunkResults = await Promise.all(
            chunk.map((item) => processor(item)),
          );
          results.push(...chunkResults);

          processedCount += chunk.length;
          const increment = (chunk.length / totalItems) * 100;
          progress.report({
            increment,
            message: `Processed ${processedCount} of ${totalItems} items`,
          });

          // Add delay between chunks to prevent UI freezing
          if (options.delayBetweenChunks > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, options.delayBetweenChunks),
            );
          }
        }
      },
    );

    return results;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  clearQueue(): void {
    this.queue = [];
    this.isProcessing = false;
  }

  get currentQueueSize(): number {
    return this.queue.length;
  }
}
