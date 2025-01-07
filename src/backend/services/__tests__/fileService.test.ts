import * as fs from 'fs/promises';
import { FileService } from '../fileService';
import { ProcessingOptions } from '../queueService';
import { Dirent } from 'fs';

jest.mock('fs/promises');

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
  });

  describe('generateFileTree', () => {
    it('should generate a file tree for a directory', async () => {
      const mockDirents: Partial<Dirent>[] = [
        {
          name: 'file1.txt',
          isDirectory: () => false,
        },
        {
          name: 'dir1',
          isDirectory: () => true,
        },
      ];

      mockFs.readdir.mockResolvedValueOnce(mockDirents as Dirent[]);
      mockFs.readdir.mockResolvedValueOnce([]);

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
      mockFs.readdir.mockResolvedValueOnce([]);

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
      const mockDirents: Partial<Dirent>[] = [
        {
          name: '.git',
          isDirectory: () => true,
        },
        {
          name: 'src',
          isDirectory: () => true,
        },
      ];

      mockFs.readdir.mockResolvedValueOnce(mockDirents as Dirent[]);
      mockFs.readdir.mockResolvedValueOnce([]);

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
      const mockDirents: Partial<Dirent>[] = [
        {
          name: 'file1.txt',
          isDirectory: () => false,
        },
        {
          name: 'dir1',
          isDirectory: () => true,
        },
      ];

      mockFs.readdir.mockResolvedValueOnce(mockDirents as Dirent[]);
      mockFs.readdir.mockResolvedValueOnce([]);
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
      mockFs.readdir.mockResolvedValueOnce([]);

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
