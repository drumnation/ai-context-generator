import * as vscode from 'vscode';
import { QueueService, ProcessingOptions } from '../queueService';

// Mock vscode namespace with proper typing
const mockProgress = jest.fn();
const mockWithProgress = jest.fn();

// Create a proper mock CancellationToken
const createMockToken = (isCancelled = false): vscode.CancellationToken => ({
  isCancellationRequested: isCancelled,
  onCancellationRequested(_listener: (e: void) => void): vscode.Disposable {
    return { dispose: () => {} };
  },
});

jest.mock('vscode', () => ({
  window: {
    withProgress: (
      options: vscode.ProgressOptions,
      task: (
        progress: vscode.Progress<{ message?: string; increment?: number }>,
        token: vscode.CancellationToken,
      ) => Thenable<unknown>,
    ) => {
      mockWithProgress(options);
      const progress = { report: mockProgress };
      const token = createMockToken();
      return task(progress, token);
    },
  },
  ProgressLocation: {
    Notification: 1,
  },
}));

describe('QueueService', () => {
  let queueService: QueueService;

  beforeEach(() => {
    queueService = new QueueService();
    mockProgress.mockClear();
    mockWithProgress.mockClear();
  });

  describe('Queue Management', () => {
    it('should add items to queue with correct priority', async () => {
      await queueService.enqueue('item1', 1);
      await queueService.enqueue('item2', 2);
      await queueService.enqueue('item3', 0);

      expect(queueService.currentQueueSize).toBe(3);
    });

    it('should clear the queue', async () => {
      await queueService.enqueue('item1');
      await queueService.enqueue('item2');

      queueService.clearQueue();
      expect(queueService.currentQueueSize).toBe(0);
    });
  });

  describe('Chunked Processing', () => {
    const mockItems = Array.from({ length: 100 }, (_, i) => `item${i}`);
    const mockProcessor = jest.fn(async (item: string) => `processed_${item}`);
    const options: ProcessingOptions = {
      chunkSize: 10,
      delayBetweenChunks: 0,
    };

    beforeEach(() => {
      mockProcessor.mockClear();
    });

    it('should process all items in chunks', async () => {
      const results = await queueService.processChunked(
        mockItems,
        mockProcessor,
        options,
      );

      expect(results).toHaveLength(mockItems.length);
      expect(mockProcessor).toHaveBeenCalledTimes(mockItems.length);
      expect(mockProgress).toHaveBeenCalled();
    });

    it('should respect chunk size', async () => {
      const smallerOptions: ProcessingOptions = {
        chunkSize: 5,
        delayBetweenChunks: 0,
      };

      await queueService.processChunked(
        mockItems,
        mockProcessor,
        smallerOptions,
      );

      // Progress should be called 20 times (100 items / 5 items per chunk)
      expect(mockProgress).toHaveBeenCalledTimes(20);
    });

    it('should handle empty input', async () => {
      const results = await queueService.processChunked(
        [],
        mockProcessor,
        options,
      );
      expect(results).toHaveLength(0);
      expect(mockProcessor).not.toHaveBeenCalled();
    });

    it('should handle processor errors', async () => {
      const errorProcessor = jest.fn(async (item: string) => {
        if (item === 'item5') {
          throw new Error('Test error');
        }
        return `processed_${item}`;
      });

      await expect(
        queueService.processChunked(mockItems, errorProcessor, options),
      ).rejects.toThrow('Test error');
    });

    it('should respect cancellation token', async () => {
      const cancelToken = createMockToken(true);
      const optionsWithCancel: ProcessingOptions = {
        ...options,
        cancelToken,
      };

      const results = await queueService.processChunked(
        mockItems,
        mockProcessor,
        optionsWithCancel,
      );

      expect(results).toHaveLength(0);
      expect(mockProcessor).not.toHaveBeenCalled();
    });

    it('should report progress correctly', async () => {
      await queueService.processChunked(mockItems, mockProcessor, options);

      const progressCalls = mockProgress.mock.calls;
      const firstCall = progressCalls[0][0];
      const lastCall = progressCalls[progressCalls.length - 1][0];

      expect(firstCall.increment).toBeLessThanOrEqual(100);
      expect(lastCall.message).toContain('Processed');

      // Verify progress options
      expect(mockWithProgress).toHaveBeenCalledWith({
        location: vscode.ProgressLocation.Notification,
        title: 'Processing files...',
        cancellable: true,
      });
    });
  });
});
