// Mock VSCode
jest.mock('vscode', () => {
  return {
    window: {
      withProgress: jest.fn((options, task) => {
        const progress = { report: jest.fn() };
        const token = {
          isCancellationRequested: false,
          onCancellationRequested: () => ({ dispose: () => {} }),
        };
        return task(progress, token);
      }),
    },
    ProgressLocation: {
      Notification: 1,
    },
  };
});

import {
  QueueService,
  ProcessingOptions,
} from '../backend/services/queueService';

describe('QueueService', () => {
  let queueService: QueueService;
  let mockProcessingFunction: jest.Mock;

  beforeEach(() => {
    mockProcessingFunction = jest.fn();
    queueService = new QueueService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should process items in order', async () => {
    const items = ['item1', 'item2', 'item3'];
    const options: ProcessingOptions = {
      chunkSize: 1,
      delayBetweenChunks: 0,
    };

    mockProcessingFunction.mockResolvedValueOnce('result1');
    mockProcessingFunction.mockResolvedValueOnce('result2');
    mockProcessingFunction.mockResolvedValueOnce('result3');

    const results = await queueService.processChunked(
      items,
      mockProcessingFunction,
      options,
    );

    expect(results).toEqual(['result1', 'result2', 'result3']);
    expect(mockProcessingFunction).toHaveBeenCalledTimes(3);
    expect(mockProcessingFunction.mock.calls[0][0]).toBe('item1');
    expect(mockProcessingFunction.mock.calls[1][0]).toBe('item2');
    expect(mockProcessingFunction.mock.calls[2][0]).toBe('item3');
  });

  it('should respect chunk size and delay', async () => {
    const items = ['item1', 'item2', 'item3', 'item4'];
    const options: ProcessingOptions = {
      chunkSize: 2,
      delayBetweenChunks: 100,
    };

    mockProcessingFunction.mockResolvedValue('result');

    const startTime = Date.now();
    await queueService.processChunked(items, mockProcessingFunction, options);
    const endTime = Date.now();

    expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    expect(mockProcessingFunction).toHaveBeenCalledTimes(4);
  });

  it('should handle empty item list', async () => {
    const items: string[] = [];
    const options: ProcessingOptions = {
      chunkSize: 1,
      delayBetweenChunks: 0,
    };

    const results = await queueService.processChunked(
      items,
      mockProcessingFunction,
      options,
    );

    expect(results).toEqual([]);
    expect(mockProcessingFunction).not.toHaveBeenCalled();
  });

  it('should handle processing errors', async () => {
    const items = ['item1', 'item2'];
    const options: ProcessingOptions = {
      chunkSize: 1,
      delayBetweenChunks: 0,
    };

    const error = new Error('Processing error');
    mockProcessingFunction.mockRejectedValue(error);

    await expect(
      queueService.processChunked(items, mockProcessingFunction, options),
    ).rejects.toThrow('Processing error');
  });

  it('should respect cancellation token', async () => {
    const items = ['item1', 'item2', 'item3'];
    const options: ProcessingOptions = {
      chunkSize: 1,
      delayBetweenChunks: 0,
      cancelToken: {
        isCancellationRequested: true,
        onCancellationRequested: () => ({ dispose: () => {} }),
      },
    };

    const results = await queueService.processChunked(
      items,
      mockProcessingFunction,
      options,
    );

    expect(results).toEqual([]);
    expect(mockProcessingFunction).not.toHaveBeenCalled();
  });

  it('should handle cancellation during processing', async () => {
    const items = ['item1', 'item2', 'item3'];
    let isCancelled = false;
    const options: ProcessingOptions = {
      chunkSize: 1,
      delayBetweenChunks: 0,
      cancelToken: {
        get isCancellationRequested() {
          return isCancelled;
        },
        onCancellationRequested: () => ({ dispose: () => {} }),
      },
    };

    mockProcessingFunction.mockImplementation(async () => {
      if (mockProcessingFunction.mock.calls.length === 2) {
        isCancelled = true;
      }
      return 'result';
    });

    const results = await queueService.processChunked(
      items,
      mockProcessingFunction,
      options,
    );

    expect(results).toEqual(['result', 'result']);
    expect(mockProcessingFunction).toHaveBeenCalledTimes(2);
  });
});
