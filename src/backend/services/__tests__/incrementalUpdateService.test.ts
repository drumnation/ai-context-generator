import { IncrementalUpdateService } from '../incrementalUpdateService';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import {
  ProgressService,
  ProgressOptions,
  ProgressUpdate,
} from '../progressService';
import { ProcessingOptions } from '../queueService';
import * as vscode from 'vscode';
import { Mock } from 'jest-mock';

type ProgressCallback<T> = (
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  token: vscode.CancellationToken,
) => Promise<T>;

// Mock ProgressService
const mockProgressService = {
  withProgress: jest
    .fn()
    .mockImplementation(
      async <T>(
        _taskId: string,
        _options: ProgressOptions,
        callback: ProgressCallback<T>,
      ): Promise<T> => {
        const mockProgress = {
          report: jest.fn(),
        };
        const mockToken = {
          isCancellationRequested: false,
          onCancellationRequested: jest.fn(),
        };
        return callback(mockProgress, mockToken);
      },
    ) as Mock<ProgressService['withProgress']>,
  updateProgress: jest.fn() as Mock<
    (taskId: string, update: ProgressUpdate) => void
  >,
  activeTasks: new Map(),
  cancelTask: jest.fn() as Mock<(taskId: string) => void>,
  isTaskActive: jest
    .fn()
    .mockImplementation((_taskId: string) => false) as Mock<
    (taskId: string) => boolean
  >,
  getTaskProgress: jest
    .fn()
    .mockImplementation((_taskId: string) => undefined) as Mock<
    (taskId: string) => number | undefined
  >,
} as unknown as ProgressService;

jest.mock('../progressService', () => ({
  ProgressService: jest.fn().mockImplementation(() => mockProgressService),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readdir: jest.fn(),
    stat: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
  },
}));

describe('IncrementalUpdateService', () => {
  let service: IncrementalUpdateService;
  let mockFiles: { [key: string]: { mtime: Date; size: number } };
  const testDir = '/test/dir';
  const _options: ProcessingOptions = {
    chunkSize: 50,
    delayBetweenChunks: 10,
  };

  beforeEach(() => {
    service = new IncrementalUpdateService(
      mockProgressService as ProgressService,
    );
    mockFiles = {};

    // Reset mocks
    jest.clearAllMocks();

    // Mock file system functions with improved type safety
    (fsPromises.readdir as jest.Mock).mockImplementation(
      async (
        _dir: string,
      ): Promise<
        Array<{
          name: string;
          isDirectory: () => boolean;
          isFile: () => boolean;
        }>
      > => {
        const files = Object.keys(mockFiles).map((filePath) => ({
          name: path.basename(filePath),
          isDirectory: () => false,
          isFile: () => true,
        }));
        return files;
      },
    );

    (fsPromises.stat as jest.Mock).mockImplementation(
      async (
        filePath: string,
      ): Promise<{ mtime: Date; size: number; isDirectory: () => boolean }> => {
        const fileData = mockFiles[filePath];
        if (!fileData) {
          throw new Error(`File not found: ${filePath}`);
        }
        return {
          mtime: fileData.mtime,
          size: fileData.size,
          isDirectory: () => false,
        };
      },
    );

    // Reset the default mock implementation for progress
    (
      mockProgressService.withProgress as Mock<ProgressService['withProgress']>
    ).mockImplementation(
      async <T>(
        _taskId: string,
        _options: ProgressOptions,
        callback: ProgressCallback<T>,
      ): Promise<T> => {
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectChanges', () => {
    it('should detect new files with progress tracking', async () => {
      // Setup
      const file1 = path.join(testDir, 'file1.txt');
      mockFiles[file1] = { mtime: new Date(), size: 100 };

      // Test
      const result = await service.detectChanges(testDir, [], _options);

      // Verify
      expect(result.newFiles).toContain(file1);
      expect(result.changedFiles).toHaveLength(0);
      expect(result.deletedFiles).toHaveLength(0);
      expect(mockProgressService.withProgress).toHaveBeenCalled();
      const mockCall = (
        mockProgressService.withProgress as Mock<
          ProgressService['withProgress']
        >
      ).mock.calls[0];
      expect(mockCall[1]).toEqual({
        title: 'Detecting file changes',
        cancellable: true,
      });
    });

    it('should handle cancellation during detection', async () => {
      // Setup
      const file1 = path.join(testDir, 'file1.txt');
      mockFiles[file1] = { mtime: new Date(), size: 100 };

      // Override progress mock for cancellation
      (
        mockProgressService.withProgress as Mock<
          ProgressService['withProgress']
        >
      ).mockImplementationOnce(
        async <T>(
          _taskId: string,
          _options: ProgressOptions,
          callback: ProgressCallback<T>,
        ): Promise<T> => {
          const mockProgress = {
            report: jest.fn(),
          };
          const mockToken = {
            isCancellationRequested: true,
            onCancellationRequested: jest.fn(),
          };
          return callback(mockProgress, mockToken);
        },
      );

      // Test
      const result = await service.detectChanges(testDir, [], _options);

      // Verify
      expect(result.newFiles).toHaveLength(0);
      expect(result.changedFiles).toHaveLength(0);
      expect(result.deletedFiles).toHaveLength(0);
    });

    it('should process files in parallel chunks', async () => {
      // Setup
      const files = Array.from({ length: 10 }, (_, i) => {
        const file = path.join(testDir, `file${i}.txt`);
        mockFiles[file] = { mtime: new Date(), size: 100 };
        return file;
      });

      // Test
      const result = await service.detectChanges(testDir, [], {
        ..._options,
        chunkSize: 3, // Process 3 files at a time
      });

      // Verify
      expect(result.newFiles).toHaveLength(10);
      expect(result.newFiles).toEqual(expect.arrayContaining(files));
      expect(mockProgressService.withProgress).toHaveBeenCalled();
    });

    it('should handle errors gracefully with proper error messages', async () => {
      // Setup
      const errorMessage = 'Access denied: insufficient permissions';
      (fsPromises.readdir as jest.Mock).mockRejectedValue(
        new Error(errorMessage),
      );

      // Test & Verify
      await expect(
        service.detectChanges(testDir, [], _options),
      ).rejects.toThrow(errorMessage);
      expect(mockProgressService.withProgress).toHaveBeenCalled();
    });

    it('should detect deleted files', async () => {
      // Setup
      const previousFiles = [path.join(testDir, 'deleted.txt')];
      mockFiles = {}; // Empty current directory

      // Test
      const result = await service.detectChanges(
        testDir,
        previousFiles,
        _options,
      );

      // Verify
      expect(result.deletedFiles).toContain(previousFiles[0]);
      expect(result.newFiles).toHaveLength(0);
      expect(result.changedFiles).toHaveLength(0);
      expect(mockProgressService.withProgress).toHaveBeenCalled();
    });

    it('should detect modified files', async () => {
      // Setup
      const file1 = path.join(testDir, 'file1.txt');
      mockFiles[file1] = { mtime: new Date(), size: 100 };

      // First pass to establish baseline
      await service.detectChanges(testDir, [file1], _options);

      // Modify file
      mockFiles[file1] = { mtime: new Date(Date.now() + 1000), size: 200 };

      // Test
      const result = await service.detectChanges(testDir, [file1], _options);

      // Verify
      expect(result.changedFiles).toContain(file1);
      expect(result.newFiles).toHaveLength(0);
      expect(result.deletedFiles).toHaveLength(0);
      expect(mockProgressService.withProgress).toHaveBeenCalledTimes(2);
    });
  });

  describe('file state management', () => {
    it('should clear file states', async () => {
      // Setup
      const file1 = path.join(testDir, 'file1.txt');
      mockFiles[file1] = { mtime: new Date(), size: 100 };
      await service.detectChanges(testDir, []);

      // Test
      service.clearStates();

      // Verify - next detection should treat file as new
      const result = await service.detectChanges(testDir, [file1]);
      expect(result.changedFiles).toContain(file1);
    });

    it('should handle state validity duration', async () => {
      // Setup
      const file1 = path.join(testDir, 'file1.txt');
      const initialTime = new Date();
      mockFiles[file1] = { mtime: initialTime, size: 100 };

      // First detection
      await service.detectChanges(testDir, [file1]);

      // Mock date to be after validity duration (24 hours)
      const futureTime = new Date(initialTime.getTime() + 25 * 60 * 60 * 1000);
      jest.spyOn(Date, 'now').mockImplementation(() => futureTime.getTime());

      // Test
      const result = await service.detectChanges(testDir, [file1]);

      // Verify - file should be treated as changed due to expired state
      expect(result.changedFiles).toContain(file1);
    });
  });

  describe('getAllFiles', () => {
    it('should return all files in directory', async () => {
      // Setup
      const files = [
        path.join(testDir, 'file1.txt'),
        path.join(testDir, 'file2.txt'),
      ];
      files.forEach((file) => {
        mockFiles[file] = { mtime: new Date(), size: 100 };
      });

      // Test
      const result = await service.getAllFiles(testDir);

      // Verify
      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining(files));
    });

    it('should handle empty directories', async () => {
      // Setup
      mockFiles = {};

      // Test
      const result = await service.getAllFiles(testDir);

      // Verify
      expect(result).toHaveLength(0);
    });
  });
});
