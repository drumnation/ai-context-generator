import { IncrementalUpdateService } from '../incrementalUpdateService';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { ProgressService, ProgressOptions } from '../progressService';
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
  updateProgress: jest.fn(),
  activeTasks: new Map(),
  cancelTask: jest.fn(),
  isTaskActive: jest.fn().mockImplementation(() => false),
  getTaskProgress: jest.fn().mockImplementation(() => undefined),
} as unknown as ProgressService;

jest.mock('../progressService', () => ({
  ProgressService: jest.fn().mockImplementation(() => mockProgressService),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readdir: jest.fn(),
    stat: jest.fn(),
  },
}));

describe('IncrementalUpdateService', () => {
  let service: IncrementalUpdateService;
  let mockFiles: { [key: string]: { mtime: Date; size: number } };
  const testDir = path.normalize('/test/dir');
  const _options: ProcessingOptions = {
    chunkSize: 50,
    delayBetweenChunks: 10,
  };

  beforeEach(() => {
    // Clear mock files
    mockFiles = {};

    // Initialize test files with normalized paths
    const file1 = path.normalize('/test/dir/file1.txt');
    mockFiles[file1] = { mtime: new Date(), size: 100 };

    // Initialize service with default patterns
    service = new IncrementalUpdateService(mockProgressService, {
      include: [],
      exclude: [],
    });

    // Reset mocks
    jest.clearAllMocks();

    // Mock readdir with proper withFileTypes support
    (fsPromises.readdir as jest.Mock).mockImplementation(
      async (dir: string, options?: { withFileTypes: boolean }) => {
        const normalizedDir = path.normalize(dir);
        const entries = Object.keys(mockFiles)
          .filter((filePath) => {
            const normalizedPath = path.normalize(filePath);
            return path.dirname(normalizedPath) === normalizedDir;
          })
          .map((filePath) => {
            const name = path.basename(filePath);
            if (options?.withFileTypes) {
              return {
                name,
                isDirectory: () => {
                  const fullPath = path.join(normalizedDir, name);
                  return Object.keys(mockFiles).some((f) =>
                    path
                      .normalize(f)
                      .startsWith(path.normalize(fullPath) + path.sep),
                  );
                },
                isFile: () =>
                  mockFiles[path.join(normalizedDir, name)] !== undefined,
                isSymbolicLink: () => false,
              };
            }
            return name;
          });

        // Add directory entries for parent directories of files
        Object.keys(mockFiles)
          .filter((filePath) => {
            const normalizedPath = path.normalize(filePath);
            const parentDir = path.dirname(normalizedPath);
            return (
              parentDir.startsWith(normalizedDir + path.sep) &&
              path.dirname(parentDir) === normalizedDir
            );
          })
          .map((filePath) => path.dirname(path.normalize(filePath)))
          .filter((dirPath, index, self) => self.indexOf(dirPath) === index)
          .forEach((dirPath) => {
            const name = path.basename(dirPath);
            if (options?.withFileTypes) {
              entries.push({
                name,
                isDirectory: () => true,
                isFile: () => false,
                isSymbolicLink: () => false,
              });
            } else {
              entries.push(name);
            }
          });

        return entries;
      },
    );

    // Mock stat with proper file metadata
    (fsPromises.stat as jest.Mock).mockImplementation(
      async (filePath: string) => {
        const normalizedPath = path.normalize(filePath);
        const fileData = mockFiles[normalizedPath];

        // Check if it's a directory
        const isDir = Object.keys(mockFiles).some((f) =>
          path.normalize(f).startsWith(normalizedPath + path.sep),
        );

        if (isDir) {
          return {
            isDirectory: () => true,
            isFile: () => false,
            mtime: new Date(),
            size: 0,
          };
        }

        if (!fileData) {
          throw new Error('ENOENT: no such file or directory');
        }

        return {
          isDirectory: () => false,
          isFile: () => true,
          mtime: fileData.mtime,
          size: fileData.size,
        };
      },
    );
  });

  describe('detectChanges', () => {
    it('should detect files with progress tracking', async () => {
      // Setup
      const file1 = path.normalize(path.join(testDir, 'file1.txt'));
      mockFiles[file1] = { mtime: new Date(), size: 100 };

      // Test
      const result = await service.detectChanges(testDir, [], _options);

      // Verify
      expect(result.files).toContain(file1);
      expect(result.files).toHaveLength(1);
      expect(result.added).toContain(file1);
      expect(result.added).toHaveLength(1);
      expect(result.removed).toHaveLength(0);
      expect(result.unchanged).toHaveLength(0);
    });

    it('should detect added and removed files', async () => {
      // Setup initial state
      const file1 = path.normalize(path.join(testDir, 'file1.txt'));
      const file2 = path.normalize(path.join(testDir, 'file2.txt'));
      mockFiles[file1] = { mtime: new Date(), size: 100 };

      // Get initial state
      const initialResult = await service.detectChanges(testDir, [], _options);
      expect(initialResult.files).toContain(file1);

      // Modify files
      mockFiles[file2] = { mtime: new Date(), size: 100 }; // Add new file
      delete mockFiles[file1]; // Remove existing file

      // Test
      const result = await service.detectChanges(
        testDir,
        initialResult.files,
        _options,
      );

      // Verify
      expect(result.files).toContain(file2);
      expect(result.files).toHaveLength(1);
      expect(result.added).toContain(file2);
      expect(result.added).toHaveLength(1);
      expect(result.removed).toContain(file1);
      expect(result.removed).toHaveLength(1);
      expect(result.unchanged).toHaveLength(0);
    });

    it('should detect unchanged files', async () => {
      // Setup
      const file1 = path.normalize(path.join(testDir, 'file1.txt'));
      const file2 = path.normalize(path.join(testDir, 'file2.txt'));
      mockFiles[file1] = { mtime: new Date(), size: 100 };
      mockFiles[file2] = { mtime: new Date(), size: 100 };

      // Get initial state
      const initialResult = await service.detectChanges(testDir, [], _options);

      // Test - detect changes with same files
      const result = await service.detectChanges(
        testDir,
        initialResult.files,
        _options,
      );

      // Verify
      expect(result.files).toHaveLength(2);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.unchanged).toHaveLength(2);
      expect(result.unchanged).toContain(file1);
      expect(result.unchanged).toContain(file2);
    });

    it('should handle file patterns correctly', async () => {
      // Setup with specific patterns
      service = new IncrementalUpdateService(mockProgressService, {
        include: ['**/*.ts', '**/*.js'],
        exclude: ['**/node_modules/**', '**/dist/**'],
      });

      const files = [
        path.normalize('/test/dir/src/file1.ts'),
        path.normalize('/test/dir/src/file2.js'),
        path.normalize('/test/dir/src/file3.txt'),
        path.normalize('/test/dir/node_modules/pkg/file.js'),
        path.normalize('/test/dir/dist/file.ts'),
      ];

      // Add all files to mock system
      files.forEach((file) => {
        mockFiles[file] = { mtime: new Date(), size: 100 };
      });

      // Test
      const result = await service.detectChanges(testDir, [], _options);

      // Verify - should only include .ts and .js files outside node_modules and dist
      expect(result.files).toHaveLength(2);
      expect(result.files).toContain(files[0]); // src/file1.ts
      expect(result.files).toContain(files[1]); // src/file2.js
      expect(result.files).not.toContain(files[2]); // src/file3.txt
      expect(result.files).not.toContain(files[3]); // node_modules/pkg/file.js
      expect(result.files).not.toContain(files[4]); // dist/file.ts
    });

    it('should handle nested directories correctly', async () => {
      // Setup
      const files = [
        path.normalize('/test/dir/src/components/Button.tsx'),
        path.normalize('/test/dir/src/utils/helpers.ts'),
        path.normalize('/test/dir/src/deep/nested/file.ts'),
      ];

      // Add all files to mock system
      files.forEach((file) => {
        mockFiles[file] = { mtime: new Date(), size: 100 };
      });

      // Test
      const result = await service.detectChanges(testDir, [], _options);

      // Verify
      expect(result.files).toHaveLength(3);
      expect(result.files).toEqual(expect.arrayContaining(files));
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
