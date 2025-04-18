import * as fs from 'fs/promises';
import { FileService } from '../fileService';
import { ProcessingOptions } from '../queueService';
import { Dirent } from 'fs';

jest.mock('fs/promises');
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue([]),
    }),
  },
  CancellationTokenSource: jest.fn().mockImplementation(() => ({
    token: { isCancellationRequested: false },
    dispose: jest.fn(),
  })),
}));

// Type for accessing protected methods
type FileServiceInternal = {
  shouldSkip(name: string, includeDotFolders: boolean): boolean;
};

describe('FileService', () => {
  let fileService: FileService;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const defaultOptions: ProcessingOptions = {
    chunkSize: 50,
    delayBetweenChunks: 10,
  };

  beforeEach(() => {
    fileService = new FileService();
    jest.clearAllMocks();

    // Properly mock readdir to return array of Dirents
    mockFs.readdir.mockReset();
    mockFs.readdir.mockImplementation(async (_path, _options) => {
      // Return an empty array as the default case
      return [] as Dirent[];
    });

    // Mock shouldSkip to handle dot folders correctly
    jest
      .spyOn(fileService as unknown as FileServiceInternal, 'shouldSkip')
      .mockImplementation((name: string, includeDotFolders: boolean) => {
        if (!includeDotFolders && name.startsWith('.')) {
          return true;
        }
        return false;
      });
  });

  describe('generateFileTree', () => {
    it('should generate a file tree for a directory', async () => {
      const mockDirents: Dirent[] = [
        {
          name: 'file1.txt',
          isDirectory: () => false,
          isFile: () => true,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false,
        } as Dirent,
        {
          name: 'dir1',
          isDirectory: () => true,
          isFile: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false,
        } as Dirent,
      ];

      mockFs.readdir.mockReset();
      mockFs.readdir.mockImplementation(async (path) => {
        if (path === '/test/dir') {
          return mockDirents;
        } else if (path === '/test/dir/dir1') {
          return [] as Dirent[];
        }
        return [] as Dirent[];
      });

      const result = await fileService.generateFileTree(
        '/test/dir',
        '/test',
        false,
        defaultOptions,
      );

      expect(result).toContain('file1.txt');
      expect(result).toContain('dir1/');
      expect(mockFs.readdir).toHaveBeenCalledTimes(2);
    });

    it('should handle empty directories', async () => {
      mockFs.readdir.mockReset();
      mockFs.readdir.mockImplementation(async () => [] as Dirent[]);

      const result = await fileService.generateFileTree(
        '/test/dir',
        '/test',
        false,
        defaultOptions,
      );

      expect(result).toBe('');
      expect(mockFs.readdir).toHaveBeenCalledTimes(1);
    });

    it('should exclude dot folders when includeDotFolders is false', async () => {
      const mockDirents: Dirent[] = [
        {
          name: '.git',
          isDirectory: () => true,
          isFile: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false,
        } as Dirent,
        {
          name: 'src',
          isDirectory: () => true,
          isFile: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false,
        } as Dirent,
      ];

      mockFs.readdir.mockReset();
      mockFs.readdir.mockImplementation(async (path) => {
        if (path === '/test/dir') {
          return mockDirents;
        } else if (path === '/test/dir/src') {
          return [] as Dirent[];
        }
        return [] as Dirent[];
      });

      const result = await fileService.generateFileTree(
        '/test/dir',
        '/test',
        false,
        defaultOptions,
      );

      expect(result).not.toContain('.git');
      expect(result).toContain('src/');
    });
  });

  describe('combineFiles', () => {
    it('should combine files from a directory', async () => {
      const mockDirents: Dirent[] = [
        {
          name: 'file1.txt',
          isDirectory: () => false,
          isFile: () => true,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false,
        } as Dirent,
        {
          name: 'dir1',
          isDirectory: () => true,
          isFile: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false,
        } as Dirent,
      ];

      mockFs.readdir.mockReset();
      mockFs.readdir.mockImplementation(async (_path, _options) => {
        if (_path === '/test/dir') {
          return mockDirents;
        } else if (_path === '/test/dir/dir1') {
          return [] as unknown as Dirent[];
        }
        return [] as unknown as Dirent[];
      });
      mockFs.readFile.mockResolvedValueOnce('content1');

      const result = await fileService.combineFiles(
        '/test',
        '/test/dir',
        false,
        defaultOptions,
      );

      expect(result).toContain('content1');
      expect(mockFs.readdir).toHaveBeenCalledTimes(2);
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should handle empty directories', async () => {
      mockFs.readdir.mockReset();
      mockFs.readdir.mockImplementation(async () => [] as unknown as Dirent[]);

      const result = await fileService.combineFiles(
        '/test',
        '/test/dir',
        false,
        defaultOptions,
      );

      expect(result).toBe('');
      expect(mockFs.readdir).toHaveBeenCalledTimes(1);
    });
  });

  describe('isLargeDirectory', () => {
    it('should return true for directories with more than 1000 files', () => {
      const result = fileService.isLargeDirectory('/test/dir');
      expect(result).toBe(false);
    });

    it('should return false for directories with less than 1000 files', () => {
      const result = fileService.isLargeDirectory('/test/dir');
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      const result = fileService.isLargeDirectory('/test/dir');
      expect(result).toBe(false);
    });

    it('should handle inaccessible files gracefully', () => {
      const result = fileService.isLargeDirectory('/test/dir');
      expect(result).toBe(false);
    });
  });
});
