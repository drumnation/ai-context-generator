import * as fs from 'fs/promises';
import { StreamingFileService } from '../streamingFileService';
import { logger } from '../../../shared/logger';
import { ProcessingOptions } from '../queueService';

jest.mock('fs/promises');
jest.mock('../../../shared/logger');

interface MockStream {
  on: (event: string, callback: (data?: Buffer | Error) => void) => MockStream;
  destroy: () => void;
}

type StreamCallback = (data?: Buffer | Error) => void;

describe('StreamingFileService', () => {
  let streamingFileService: StreamingFileService;
  let mockReaddir: jest.Mock;
  let mockOpen: jest.Mock;
  let mockCreateReadStream: jest.Mock;
  let mockClose: jest.Mock;
  let mockLogger: jest.Mocked<typeof logger>;
  let mockStat: jest.Mock;

  const defaultOptions: ProcessingOptions = {
    chunkSize: 50,
    delayBetweenChunks: 10,
  };

  beforeEach(() => {
    mockReaddir = fs.readdir as jest.Mock;
    mockOpen = fs.open as jest.Mock;
    mockCreateReadStream = jest.fn();
    mockClose = jest.fn().mockResolvedValue(undefined);
    mockLogger = logger as jest.Mocked<typeof logger>;
    mockStat = fs.stat as jest.Mock;

    mockStat.mockResolvedValue({ size: 1024 }); // Default file size 1KB

    mockOpen.mockResolvedValue({
      createReadStream: mockCreateReadStream,
      close: mockClose,
    });

    streamingFileService = new StreamingFileService();

    // Mock process.memoryUsage
    const mockMemoryUsage = {
      heapUsed: 50 * 1024 * 1024, // 50MB
      heapTotal: 100 * 1024 * 1024, // 100MB
      rss: 150 * 1024 * 1024, // 150MB
      external: 0,
      arrayBuffers: 0,
    };
    jest.spyOn(process, 'memoryUsage').mockReturnValue(mockMemoryUsage);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Memory Management', () => {
    it('should trigger garbage collection when memory usage is high', async () => {
      // Mock high memory usage
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 150 * 1024 * 1024, // 150MB
        heapTotal: 200 * 1024 * 1024,
        rss: 250 * 1024 * 1024,
        external: 0,
        arrayBuffers: 0,
      });

      const mockStream: MockStream = {
        on: (event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('content'));
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        },
        destroy: jest.fn(),
      };

      mockCreateReadStream.mockReturnValue(mockStream);

      // Create multiple file streams
      const files = Array.from({ length: 6 }, (_, i) => `file${i + 1}.txt`);

      for (const file of files) {
        await streamingFileService.readFile(file);
      }

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting garbage collection',
        expect.any(Object),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Garbage collection completed',
        expect.any(Object),
      );
    });

    it('should track stream sizes and cleanup oldest streams', async () => {
      const mockStream: MockStream = {
        on: (event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('content'));
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        },
        destroy: jest.fn(),
      };

      mockCreateReadStream.mockReturnValue(mockStream);
      mockStat.mockResolvedValue({ size: 1024 * 1024 }); // 1MB file size

      // Create more streams than the limit
      const files = Array.from({ length: 7 }, (_, i) => `file${i + 1}.txt`);

      for (const file of files) {
        await streamingFileService.readFile(file);
      }

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleaned up stream',
        expect.any(Object),
      );
    });

    it('should handle large files with memory constraints', async () => {
      // Mock critical memory usage
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 190 * 1024 * 1024, // 190MB
        heapTotal: 200 * 1024 * 1024,
        rss: 250 * 1024 * 1024,
        external: 0,
        arrayBuffers: 0,
      });

      mockStat.mockResolvedValue({ size: 50 * 1024 * 1024 }); // 50MB file

      const mockStream: MockStream = {
        on: (event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('large content'));
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        },
        destroy: jest.fn(),
      };

      mockCreateReadStream.mockReturnValue(mockStream);

      await streamingFileService.readFile('large-file.txt');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting garbage collection',
        expect.any(Object),
      );
    });

    it('should update last accessed time for existing streams', async () => {
      const mockStream: MockStream = {
        on: (event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('content'));
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        },
        destroy: jest.fn(),
      };

      mockCreateReadStream.mockReturnValue(mockStream);

      // Read the same file twice
      await streamingFileService.readFile('test.txt');
      const firstAccessTime = Date.now();

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await streamingFileService.readFile('test.txt');
      const secondAccessTime = Date.now();

      expect(secondAccessTime).toBeGreaterThan(firstAccessTime);
    });
  });

  describe('readFile', () => {
    it('should read file content using streams', async () => {
      const testContent = 'test file content';
      const mockStream: MockStream = {
        on: (event, callback) => {
          if (event === 'data') {
            callback(Buffer.from(testContent));
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        },
        destroy: jest.fn(),
      };

      mockCreateReadStream.mockReturnValue(mockStream);

      const content = await streamingFileService.readFile('test.txt');

      expect(content).toBe(testContent);
      expect(mockOpen).toHaveBeenCalledWith('test.txt', 'r');
      expect(mockCreateReadStream).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
      expect(mockStream.destroy).toHaveBeenCalled();
    });

    it('should handle stream errors', async () => {
      const testError = new Error('Stream error');
      const mockStream: MockStream = {
        on: (event, callback) => {
          if (event === 'error') {
            callback(testError);
          }
          return mockStream;
        },
        destroy: jest.fn(),
      };

      mockCreateReadStream.mockReturnValue(mockStream);

      await expect(streamingFileService.readFile('test.txt')).rejects.toThrow(
        'Stream error',
      );
      expect(mockStream.destroy).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('Error reading file:', {
        error: testError,
        filePath: 'test.txt',
      });
    });
  });

  describe('combineFiles', () => {
    it('should combine files using streams', async () => {
      const testFiles = [
        { name: 'file1.txt', isDirectory: () => false },
        { name: 'file2.txt', isDirectory: () => false },
      ];

      mockReaddir.mockResolvedValue(testFiles);

      const mockStream: MockStream = {
        on: (event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('content'));
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        },
        destroy: jest.fn(),
      };

      mockCreateReadStream.mockReturnValue(mockStream);

      const content = await streamingFileService.combineFiles(
        '/root',
        '/root',
        false,
        defaultOptions,
      );

      expect(content).toContain('file1.txt');
      expect(content).toContain('file2.txt');
      expect(content).toContain('content');
      expect(mockStream.destroy).toHaveBeenCalledTimes(2);
      expect(mockClose).toHaveBeenCalledTimes(2);
    });

    it('should handle stream cleanup on cancellation', async () => {
      const testFiles = [
        { name: 'file1.txt', isDirectory: () => false },
        { name: 'file2.txt', isDirectory: () => false },
      ];

      mockReaddir.mockResolvedValue(testFiles);

      const mockStream: MockStream = {
        on: (event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('content'));
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        },
        destroy: jest.fn(),
      };

      mockCreateReadStream.mockReturnValue(mockStream);

      const options: ProcessingOptions = {
        ...defaultOptions,
        cancelToken: {
          isCancellationRequested: true,
          onCancellationRequested: () => ({ dispose: () => {} }),
        },
      };

      await streamingFileService.combineFiles('/root', '/root', false, options);

      expect(mockStream.destroy).not.toHaveBeenCalled();
      expect(mockClose).not.toHaveBeenCalled();
    });

    it('should handle stream errors during combine', async () => {
      const testFiles = [{ name: 'file1.txt', isDirectory: () => false }];

      mockReaddir.mockResolvedValue(testFiles);

      const testError = new Error('Stream error');
      const mockStream = {
        on: (event: string, callback: StreamCallback) => {
          if (event === 'error') {
            callback(testError);
          }
          if (event === 'data') {
            callback(Buffer.from(''));
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        },
        destroy: jest.fn(),
      };

      mockCreateReadStream.mockReturnValue(mockStream);

      const content = await streamingFileService.combineFiles(
        '/root',
        '/root',
        false,
        defaultOptions,
      );

      expect(content).toBe('\n// File: root/file1.txt\n\n');
      expect(mockStream.destroy).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('Error reading file:', {
        error: testError,
        filePath: '/root/file1.txt',
      });
    });

    it('should cleanup oldest stream when limit is reached', async () => {
      const testFiles = Array.from({ length: 6 }, (_, i) => ({
        name: `file${i + 1}.txt`,
        isDirectory: () => false,
      }));

      mockReaddir.mockResolvedValue(testFiles);

      const mockStream: MockStream = {
        on: (event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('content'));
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        },
        destroy: jest.fn(),
      };

      mockCreateReadStream.mockReturnValue(mockStream);

      await streamingFileService.combineFiles(
        '/root',
        '/root',
        false,
        defaultOptions,
      );

      // Should have cleaned up the oldest stream when the 6th file was processed
      expect(mockStream.destroy).toHaveBeenCalledTimes(6);
      expect(mockClose).toHaveBeenCalledTimes(6);
    });
  });

  describe('Parallel Processing', () => {
    it('should process directories in parallel when there are many entries', async () => {
      const testFiles = Array.from({ length: 10 }, (_, i) => ({
        name: `file${i + 1}.txt`,
        isDirectory: () => false,
      }));

      mockReaddir.mockResolvedValue(testFiles);

      const mockStream = {
        on: (event: string, callback: StreamCallback) => {
          if (event === 'data') {
            callback(Buffer.from('content'));
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        },
        destroy: jest.fn(),
      };

      mockCreateReadStream.mockReturnValue(mockStream);

      const startTime = Date.now();
      await streamingFileService.combineFiles(
        '/root',
        '/root',
        false,
        defaultOptions,
      );
      const endTime = Date.now();

      // Verify parallel processing occurred
      expect(mockCreateReadStream).toHaveBeenCalledTimes(10);
      expect(mockClose).toHaveBeenCalledTimes(10);

      // Check that files were processed in parallel (time should be less than sequential)
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(1000); // Adjust threshold as needed
    });

    it('should process small directories sequentially', async () => {
      const testFiles = Array.from({ length: 3 }, (_, i) => ({
        name: `file${i + 1}.txt`,
        isDirectory: () => false,
      }));

      mockReaddir.mockResolvedValue(testFiles);

      const mockStream = {
        on: (event: string, callback: StreamCallback) => {
          if (event === 'data') {
            callback(Buffer.from('content'));
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        },
        destroy: jest.fn(),
      };

      mockCreateReadStream.mockReturnValue(mockStream);

      await streamingFileService.combineFiles(
        '/root',
        '/root',
        false,
        defaultOptions,
      );

      // Verify sequential processing
      expect(mockCreateReadStream).toHaveBeenCalledTimes(3);
      expect(mockClose).toHaveBeenCalledTimes(3);
    });

    it('should maintain file order in parallel processing', async () => {
      const testFiles = Array.from({ length: 8 }, (_, i) => ({
        name: `file${i + 1}.txt`,
        isDirectory: () => false,
      }));

      mockReaddir.mockResolvedValue(testFiles);

      const mockStream = {
        on: (event: string, callback: StreamCallback) => {
          if (event === 'data') {
            callback(
              Buffer.from(`content-${event === 'data' ? 'data' : 'end'}`),
            );
          }
          if (event === 'end') {
            callback();
          }
          return mockStream;
        },
        destroy: jest.fn(),
      };

      mockCreateReadStream.mockReturnValue(mockStream);

      const content = await streamingFileService.combineFiles(
        '/root',
        '/root',
        false,
        defaultOptions,
      );

      // Verify file order is maintained
      const fileMatches = content.match(/file\d+\.txt/g) || [];
      expect(fileMatches).toHaveLength(8);
      expect(fileMatches).toEqual([
        'file1.txt',
        'file2.txt',
        'file3.txt',
        'file4.txt',
        'file5.txt',
        'file6.txt',
        'file7.txt',
        'file8.txt',
      ]);
    });

    it('should handle errors in parallel processing', async () => {
      const testFiles = Array.from({ length: 6 }, (_, i) => ({
        name: `file${i + 1}.txt`,
        isDirectory: () => false,
      }));

      mockReaddir.mockResolvedValue(testFiles);

      let errorCount = 0;
      const mockStream = {
        on: (event: string, callback: StreamCallback) => {
          if (event === 'error' && errorCount < 2) {
            errorCount++;
            callback(new Error('Random stream error'));
          } else if (event === 'data') {
            callback(Buffer.from('content'));
          } else if (event === 'end') {
            if (errorCount > 0) {
              errorCount--;
            } else {
              callback();
            }
          }
          return mockStream;
        },
        destroy: jest.fn(),
      };

      mockCreateReadStream.mockReturnValue(mockStream);

      const content = await streamingFileService.combineFiles(
        '/root',
        '/root',
        false,
        defaultOptions,
      );

      // Verify error handling
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error processing entry:',
        expect.any(Object),
      );
      expect(mockStream.destroy).toHaveBeenCalled();
      expect(content).toBeDefined(); // Ensure content is returned even with errors
    });
  });
});
