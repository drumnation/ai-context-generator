import * as fs from 'fs/promises';
import { Dirent, PathLike } from 'fs';
import { FileService } from '../fileService';
import * as fsSync from 'fs';

// Mock the fs modules
jest.mock('fs/promises');
jest.mock('fs');
jest.mock('../queueService');
jest.mock('../../../shared/logger');

describe('FileService', () => {
  let fileService: FileService;
  let mockFs: jest.Mocked<typeof fs>;
  let mockFsSync: jest.Mocked<typeof fsSync>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mock filesystem
    mockFs = fs as jest.Mocked<typeof fs>;
    mockFsSync = fsSync as jest.Mocked<typeof fsSync>;

    fileService = new FileService();
  });

  describe('generateFileTree', () => {
    it('should generate a tree structure for a simple directory', async () => {
      // Setup mock directory structure
      const mockDirents = [
        {
          name: 'file1.ts',
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
        },
        {
          name: 'file2.ts',
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
        },
      ] as Dirent[];

      mockFs.readdir.mockResolvedValueOnce(mockDirents);

      const result = await fileService.generateFileTree(
        '/test/dir',
        '/test',
        false,
      );

      expect(result).toBe('dir\n' + '├── file1.ts\n' + '└── file2.ts');
    });

    it('should handle nested directories', async () => {
      // First level
      const mockDirentsLevel1 = [
        {
          name: 'dir1',
          isFile: () => false,
          isDirectory: () => true,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
        },
        {
          name: 'file1.ts',
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
        },
      ] as Dirent[];

      // Inside dir1
      const mockDirentsLevel2 = [
        {
          name: 'file2.ts',
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
        },
      ] as Dirent[];

      mockFs.readdir.mockResolvedValueOnce(mockDirentsLevel1);
      mockFs.readdir.mockResolvedValueOnce(mockDirentsLevel2);

      const result = await fileService.generateFileTree(
        '/test/dir',
        '/test',
        false,
      );

      expect(result).toBe(
        'dir\n' + '├── dir1\n' + '│   └── file2.ts\n' + '└── file1.ts',
      );
    });

    it('should exclude dot folders when includeDotFolders is false', async () => {
      const mockDirents = [
        {
          name: '.git',
          isFile: () => false,
          isDirectory: () => true,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
        },
        {
          name: 'file1.ts',
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
        },
      ] as Dirent[];

      mockFs.readdir.mockResolvedValueOnce(mockDirents);

      const result = await fileService.generateFileTree(
        '/test/dir',
        '/test',
        false,
      );

      expect(result).toBe('dir\n' + '└── file1.ts');
      expect(mockFs.readdir).toHaveBeenCalledTimes(1);
    });
  });

  describe('combineFiles', () => {
    it('should combine multiple files with correct markdown formatting', async () => {
      // Setup mock directory structure
      const mockDirents = [
        {
          name: 'file1.ts',
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
        },
        {
          name: 'file2.ts',
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
        },
      ] as Dirent[];

      mockFs.readdir.mockResolvedValueOnce(mockDirents);

      // Setup mock file contents
      mockFs.readFile.mockResolvedValueOnce('content1');
      mockFs.readFile.mockResolvedValueOnce('content2');

      const result = await fileService.combineFiles(
        '/test',
        '/test/dir',
        false,
      );

      expect(result).toContain('# ./dir/file1.ts');
      expect(result).toContain('```ts\ncontent1\n```');
      expect(result).toContain('# ./dir/file2.ts');
      expect(result).toContain('```ts\ncontent2\n```');
    });

    it('should handle file read errors gracefully', async () => {
      const mockDirents = [
        {
          name: 'file1.ts',
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
        },
      ] as Dirent[];

      mockFs.readdir.mockResolvedValueOnce(mockDirents);
      mockFs.readFile.mockRejectedValueOnce(new Error('Read error'));

      const result = await fileService.combineFiles(
        '/test',
        '/test/dir',
        false,
      );

      expect(result).toBe('');
    });
  });

  describe('isLargeDirectory', () => {
    it('should return true for directories with more than 1000 files', () => {
      // Mock readdirSync to return a large number of files
      mockFsSync.readdirSync.mockReturnValue(Array(1001).fill('file.txt'));
      mockFsSync.statSync.mockReturnValue({
        isDirectory: () => false,
      } as fsSync.Stats);

      const result = fileService.isLargeDirectory('/test/dir');

      expect(result).toBe(true);
      expect(mockFsSync.readdirSync).toHaveBeenCalledWith('/test/dir');
    });

    it('should return false for directories with 1000 or fewer files', () => {
      // Mock readdirSync to return exactly 1000 files
      mockFsSync.readdirSync.mockReturnValue(Array(1000).fill('file.txt'));
      mockFsSync.statSync.mockReturnValue({
        isDirectory: () => false,
      } as fsSync.Stats);

      const result = fileService.isLargeDirectory('/test/dir');

      expect(result).toBe(false);
      expect(mockFsSync.readdirSync).toHaveBeenCalledWith('/test/dir');
    });

    it('should count files in nested directories', () => {
      // Mock first level with 500 files and one directory
      mockFsSync.readdirSync.mockReturnValueOnce([
        ...Array(500).fill('file.txt'),
        'subdir',
      ]);

      // Mock stats to identify subdir as a directory
      mockFsSync.statSync.mockImplementation(
        (path: PathLike) =>
          ({
            isDirectory: () => path.toString().endsWith('subdir'),
          }) as fsSync.Stats,
      );

      // Mock subdir with 501 files to exceed 1000 total
      mockFsSync.readdirSync.mockReturnValueOnce(Array(501).fill('file.txt'));

      const result = fileService.isLargeDirectory('/test/dir');

      expect(result).toBe(true);
      expect(mockFsSync.readdirSync).toHaveBeenCalledTimes(2);
      expect(mockFsSync.statSync).toHaveBeenCalled();
    });

    it('should handle filesystem errors gracefully', () => {
      mockFsSync.readdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = fileService.isLargeDirectory('/test/dir');

      expect(result).toBe(false);
      expect(mockFsSync.readdirSync).toHaveBeenCalledWith('/test/dir');
    });
  });
});
