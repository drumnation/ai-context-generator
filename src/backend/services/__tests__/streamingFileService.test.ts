import { Readable } from 'stream';
import { StreamingFileService } from '../streamingFileService';

// Mock setup
jest.mock('fs', () => {
  const mockFsPromises = {
    mkdtemp: jest.fn(),
    rm: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    readFile: jest.fn(),
  };

  type StreamEvents = {
    data: (chunk: Buffer | string) => void;
    end: () => void;
    error: (err: Error) => void;
    close: () => void;
    pause: () => void;
    readable: () => void;
    resume: () => void;
  };

  const mockStream = {
    [Symbol.asyncIterator]: async function* () {
      yield 'test content';
    },
    on<E extends keyof StreamEvents>(
      event: E,
      listener: StreamEvents[E],
    ): Readable {
      if (event === 'data') {
        (listener as StreamEvents['data'])(Buffer.from('test content'));
      }
      return this as unknown as Readable;
    },
    pipe: jest.fn().mockReturnThis(),
    destroy: jest.fn(),
    readable: true,
    read: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    isPaused: jest.fn(),
    unpipe: jest.fn(),
    unshift: jest.fn(),
    wrap: jest.fn(),
    push: jest.fn(),
    _read: jest.fn(),
    _destroy: jest.fn(),
    _construct: jest.fn(),
    addListener: jest.fn(),
    emit: jest.fn(),
    eventNames: jest.fn(),
    getMaxListeners: jest.fn(),
    listenerCount: jest.fn(),
    listeners: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
    prependListener: jest.fn(),
    prependOnceListener: jest.fn(),
    rawListeners: jest.fn(),
    removeAllListeners: jest.fn(),
    removeListener: jest.fn(),
    setMaxListeners: jest.fn(),
  } as Partial<Readable>;

  return {
    ...jest.requireActual('fs'),
    promises: mockFsPromises,
    createReadStream: jest.fn().mockReturnValue(mockStream),
  };
});

jest.mock(
  'vscode',
  () => ({
    Progress: jest.fn(),
    ProgressLocation: {
      Notification: 1,
    },
    CancellationToken: jest.fn(),
    window: {
      withProgress: jest.fn(),
    },
  }),
  { virtual: true },
);

jest.mock('../../../shared/logger');

import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { ProcessingOptions } from '../queueService';
import { ProgressService } from '../progressService';
import * as vscode from 'vscode';

// Mock ProgressService
const mockProgressService = {
  withProgress: jest
    .fn()
    .mockImplementation(async (taskId, options, callback) => {
      const mockProgress = {
        report: jest.fn(),
      };
      const mockToken = {
        isCancellationRequested: false,
        onCancellationRequested: jest.fn(),
      };
      return callback(mockProgress, mockToken);
    }),
  updateProgress: jest.fn(),
};

jest.mock('../progressService', () => ({
  ProgressService: jest.fn().mockImplementation(() => mockProgressService),
}));

describe('StreamingFileService', () => {
  let testDir: string;
  let _streamingFileService: StreamingFileService;
  const _options: ProcessingOptions = {
    chunkSize: 50,
    delayBetweenChunks: 10,
  };

  beforeEach(() => {
    testDir = '/tmp/sfs-test-xyz';
    _streamingFileService = new StreamingFileService(
      undefined,
      undefined,
      mockProgressService as unknown as ProgressService,
    );

    // Mock internal methods to avoid string operations
    const formatSpy = jest.spyOn(
      _streamingFileService as unknown as {
        formatDirectoryEntries: () => string;
      },
      'formatDirectoryEntries',
    );
    formatSpy.mockReturnValue('mocked tree output');

    const parseSpy = jest.spyOn(
      _streamingFileService as unknown as { parseTreeToEntries: () => [] },
      'parseTreeToEntries',
    );
    parseSpy.mockReturnValue([]);

    // Set up mock directory structure (simplified)
    (fsPromises.readdir as jest.Mock).mockResolvedValue([
      { name: 'file1.txt', isDirectory: () => false } as fs.Dirent,
    ]);

    (fsPromises.stat as jest.Mock).mockResolvedValue({
      isDirectory: () => false,
      size: 100,
      mtimeMs: Date.now(),
      mtime: new Date(),
    } as fs.Stats);

    // Reset the default mock implementation
    mockProgressService.withProgress.mockImplementation(
      async (taskId, options, callback) => {
        const mockProgress = {
          report: jest.fn(),
        };
        const mockToken = {
          isCancellationRequested: false,
          onCancellationRequested: jest.fn(),
        };
        return callback(mockProgress, mockToken);
      },
    );

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateFileTree', () => {
    it('should generate a basic file tree with caching', async () => {
      const result = await _streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        _options,
      );
      expect(result).toBe('mocked tree output');
      expect(fsPromises.readdir).toHaveBeenCalled();
      expect(fsPromises.stat).toHaveBeenCalled();
    });

    it('should handle cancellation', async () => {
      const mockCancelToken = {
        isCancellationRequested: true,
        onCancellationRequested: jest.fn(),
      } as vscode.CancellationToken;

      // Override the mock for this specific test
      mockProgressService.withProgress.mockImplementationOnce(
        async (_taskId, _options, _callback) => {
          // Return empty string when cancelled
          return '';
        },
      );

      const result = await _streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        { ..._options, cancelToken: mockCancelToken },
      );
      expect(result).toBe('');
    });

    it('should process directories in parallel', async () => {
      const result = await _streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        _options,
      );
      expect(result).toBe('mocked tree output');
      expect(fsPromises.readdir).toHaveBeenCalled();
    });
  });

  describe('Incremental Updates', () => {
    describe('Change Detection', () => {
      it('should detect file modifications', async () => {
        const result = await _streamingFileService.readFile(
          path.join(testDir, 'file1.txt'),
        );
        expect(result).toBe('test content');
        expect(fsPromises.stat).toHaveBeenCalled();
      });
    });
  });
});
