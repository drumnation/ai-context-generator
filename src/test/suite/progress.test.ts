// Mock file system
const mockFiles = new Map<string, Buffer>();
const mockDirs = new Set<string>();

jest.mock('vscode', () => {
  const mockVSCode = {
    window: {
      withProgress: jest.fn(),
      createOutputChannel: jest.fn(),
      showInformationMessage: jest.fn(),
      showErrorMessage: jest.fn(),
    },
    ProgressLocation: {
      Notification: 1,
      SourceControl: 2,
      Window: 3,
    },
    workspace: {
      workspaceFolders: [],
      getConfiguration: jest.fn(),
    },
    Uri: {
      file: jest.fn((path: string) => ({
        scheme: 'file',
        authority: '',
        path,
        query: '',
        fragment: '',
        fsPath: path,
        with: jest.fn(),
        toString: () => `file://${path}`,
        toJSON: () => ({ scheme: 'file', path }),
      })),
      parse: jest.fn(),
    },
  };
  return mockVSCode;
});

jest.mock('fs', () => ({
  createReadStream: jest.fn((filePath: string) => {
    const content = mockFiles.get(filePath);
    if (!content) {
      throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    }
    return {
      on: jest.fn(),
      pipe: jest.fn(),
      destroy: jest.fn(),
      [Symbol.asyncIterator]: async function* () {
        yield content.toString();
      },
    };
  }),
  promises: {
    readdir: jest.fn(
      async (dirPath: string, _options: { withFileTypes: boolean }) => {
        // Get all files and directories in this directory
        const entries = new Set<string>();

        // Add files
        mockFiles.forEach((_, filePath) => {
          if (path.dirname(filePath) === dirPath) {
            entries.add(path.basename(filePath));
          }
        });

        // Add directories
        mockDirs.forEach((dirPath2) => {
          if (path.dirname(dirPath2) === dirPath) {
            entries.add(path.basename(dirPath2));
          }
        });

        return Array.from(entries).map((name) => ({
          name,
          isDirectory: () => mockDirs.has(path.join(dirPath, name)),
        }));
      },
    ),
    stat: jest.fn(async (filePath: string) => {
      const content = mockFiles.get(filePath);
      const isDir = mockDirs.has(filePath);
      if (!content && !isDir) {
        throw new Error(
          `ENOENT: no such file or directory, stat '${filePath}'`,
        );
      }
      return {
        size: content?.length || 0,
        mtimeMs: Date.now(),
        isDirectory: () => isDir,
      };
    }),
  },
}));

jest.mock('fs/promises', () => ({
  readdir: jest.fn(
    async (dirPath: string, _options: { withFileTypes: boolean }) => {
      // Get all files and directories in this directory
      const entries = new Set<string>();

      // Add files
      mockFiles.forEach((_, filePath) => {
        if (path.dirname(filePath) === dirPath) {
          entries.add(path.basename(filePath));
        }
      });

      // Add directories
      mockDirs.forEach((dirPath2) => {
        if (path.dirname(dirPath2) === dirPath) {
          entries.add(path.basename(dirPath2));
        }
      });

      return Array.from(entries).map((name) => ({
        name,
        isDirectory: () => mockDirs.has(path.join(dirPath, name)),
      }));
    },
  ),
  stat: jest.fn(async (filePath: string) => {
    const content = mockFiles.get(filePath);
    const isDir = mockDirs.has(filePath);
    if (!content && !isDir) {
      throw new Error(`ENOENT: no such file or directory, stat '${filePath}'`);
    }
    return {
      size: content?.length || 0,
      mtimeMs: Date.now(),
      isDirectory: () => isDir,
    };
  }),
}));

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { StreamingFileService } from '../../backend/services/streamingFileService';
import {
  ProgressService,
  ProgressUpdate,
} from '../../backend/services/progressService';
import { logger } from '../../shared/logger';

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

// Store original log levels
const originalLogLevels = {
  info: logger.info,
  warn: logger.warn,
  error: logger.error,
};

// Helper to suppress logs during tests
function suppressLogs() {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  logger.info = () => {};
  logger.warn = () => {};
  logger.error = () => {};
}

// Helper to restore logs
function restoreLogs() {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  logger.info = originalLogLevels.info;
  logger.warn = originalLogLevels.warn;
  logger.error = originalLogLevels.error;
}

// Mock progress and token
const mockProgress = {
  report: jest.fn(),
};

const mockToken = {
  isCancellationRequested: false,
  onCancellationRequested: jest.fn(),
};

describe('Progress Tracking Tests', () => {
  let workspaceRoot: string;

  beforeAll(() => {
    suppressLogs();
    // Setup mock for withProgress
    (vscode.window.withProgress as jest.Mock).mockImplementation(
      async (options, task) => task(mockProgress, mockToken),
    );
  });

  afterAll(() => {
    restoreLogs();
  });

  beforeEach(() => {
    // Set workspace root
    workspaceRoot = '/test/workspace';
    mockFiles.clear();
    mockDirs.clear();

    // Clear mock calls
    mockProgress.report.mockClear();
    mockToken.onCancellationRequested.mockClear();
  });

  describe('StreamingFileService Progress', () => {
    let streamingFileService: StreamingFileService;
    let progressService: ProgressService;

    beforeEach(() => {
      const workspaceRoot = '/test/workspace';
      mockFiles.clear();
      mockDirs.clear();

      // Create test files
      const testFile = path.join(workspaceRoot, 'test-file.txt');
      const content = Buffer.from('test content'.repeat(1000)); // ~11KB
      mockFiles.set(testFile, content);

      progressService = new ProgressService();
      streamingFileService = new StreamingFileService(
        50 * 1024 * 1024, // 50MB cache
        4, // max parallel ops
        progressService,
      );
    });

    it('should report progress while reading files', async () => {
      // Mock progress reporting
      const progressUpdates: { taskId: string; update: ProgressUpdate }[] = [];
      jest
        .spyOn(progressService, 'updateProgress')
        .mockImplementation((taskId: string, update: ProgressUpdate) => {
          progressUpdates.push({ taskId, update });
        });

      // Read the file
      const testFile = path.join('/test/workspace', 'test-file.txt');
      await streamingFileService.readFile(testFile);

      // Verify progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].taskId).toMatch(/^read_/);
      expect(progressUpdates[0].update.message).toMatch(
        /^Read \d+(\.\d+)?[KMGT]?B of \d+(\.\d+)?[KMGT]?B$/,
      );

      // Verify final progress
      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      expect(lastUpdate.update.current).toBe(mockFiles.get(testFile)?.length);
      expect(lastUpdate.update.total).toBe(mockFiles.get(testFile)?.length);
    });

    it('should report progress while generating file tree', async () => {
      // Create test files
      const files = ['file1.txt', 'file2.txt', 'test-file.txt'];
      const subDirs = ['subdir1', 'subdir2'];
      const rootEntries = files.length + subDirs.length;

      for (const file of files.filter((f) => f !== 'test-file.txt')) {
        const filePath = path.join(workspaceRoot, file);
        mockFiles.set(filePath, Buffer.from('test content'));
      }

      for (const dir of subDirs) {
        const dirPath = path.join(workspaceRoot, dir);
        mockDirs.add(dirPath);
        const subFilePath = path.join(dirPath, 'subfile.txt');
        mockFiles.set(subFilePath, Buffer.from('sub content'));
      }

      // Mock progress reporting
      const progressUpdates: { taskId: string; update: ProgressUpdate }[] = [];
      jest
        .spyOn(progressService, 'updateProgress')
        .mockImplementation((taskId: string, update: ProgressUpdate) => {
          progressUpdates.push({ taskId, update });
        });

      // Generate file tree
      await streamingFileService.generateFileTree(
        workspaceRoot,
        workspaceRoot,
        false,
        { chunkSize: 2, delayBetweenChunks: 0 },
      );

      // Verify progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].taskId).toMatch(/^tree_/);

      // Verify final progress shows all entries processed
      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      expect(lastUpdate.update.current).toBe(rootEntries);
      expect(lastUpdate.update.message).toContain('Processed');
    });

    it('should report progress while combining files', async () => {
      // Create test files
      const files = ['file1.txt', 'file2.txt', 'file3.txt'];
      for (const file of files) {
        const filePath = path.join(workspaceRoot, file);
        mockFiles.set(filePath, Buffer.from(`Content for ${file}`));
      }

      // Mock progress reporting
      const progressUpdates: { taskId: string; update: ProgressUpdate }[] = [];
      jest
        .spyOn(progressService, 'updateProgress')
        .mockImplementation((taskId: string, update: ProgressUpdate) => {
          progressUpdates.push({ taskId, update });
        });

      // Combine files
      await streamingFileService.combineFiles(
        workspaceRoot,
        workspaceRoot,
        false,
        {
          chunkSize: 2,
          delayBetweenChunks: 0,
        },
      );

      // Verify progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);

      // Find combine progress updates
      const combineUpdates = progressUpdates.filter((update) =>
        update.taskId.startsWith('combine_'),
      );
      expect(combineUpdates.length).toBeGreaterThan(0);

      // Verify final combine progress shows all files processed
      const lastCombineUpdate = combineUpdates[combineUpdates.length - 1];
      expect(lastCombineUpdate.update.current).toBe(
        lastCombineUpdate.update.total,
      );
      expect(lastCombineUpdate.update.message).toContain('Combined');

      // Verify read progress updates
      const readUpdates = progressUpdates.filter((update) =>
        update.taskId.startsWith('read_'),
      );
      expect(readUpdates.length).toBeGreaterThan(0);
      expect(readUpdates[0].update.message).toMatch(
        /^Read \d+(\.\d+)?[KMGT]?B of \d+(\.\d+)?[KMGT]?B$/,
      );
    });

    it('should handle cancellation during file operations', async () => {
      // Create a large test file
      const testFile = path.join(workspaceRoot, 'large-file.txt');
      const content = Buffer.from('test content'.repeat(10000)); // ~110KB
      mockFiles.set(testFile, content);

      // Mock cancellation
      const mockCancelToken = {
        isCancellationRequested: true,
        onCancellationRequested: () => ({
          dispose: () => {},
        }),
      };

      // Mock progress reporting
      const progressUpdates: { taskId: string; update: ProgressUpdate }[] = [];
      jest
        .spyOn(progressService, 'updateProgress')
        .mockImplementation((taskId: string, update: ProgressUpdate) => {
          progressUpdates.push({ taskId, update });
        });

      // Mock withProgress to use our cancellation token
      jest
        .spyOn(progressService, 'withProgress')
        .mockImplementation((...args: unknown[]) => {
          const task = args[2] as (
            progress: vscode.Progress<{ message?: string; increment?: number }>,
            token: vscode.CancellationToken,
          ) => Promise<string>;
          return task(mockProgress, mockCancelToken);
        });

      // Attempt to read file
      try {
        await streamingFileService.readFile(testFile);
        assert.fail('Should throw error when cancelled');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('cancelled');
      }
    });
  });
});
