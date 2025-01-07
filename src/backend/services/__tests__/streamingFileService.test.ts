import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { StreamingFileService } from '../streamingFileService';
import { ProcessingOptions } from '../queueService';
import * as vscode from 'vscode';

describe('StreamingFileService', () => {
  let testDir: string;
  let _streamingFileService: StreamingFileService;
  const defaultOptions: ProcessingOptions = {
    chunkSize: 50,
    delayBetweenChunks: 10,
  };

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sfs-test-'));
    _streamingFileService = new StreamingFileService();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('generateFileTree', () => {
    it('should generate a basic file tree with caching', async () => {
      await fs.mkdir(path.join(testDir, 'dir1'));
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'test');
      await fs.writeFile(path.join(testDir, 'dir1', 'file2.txt'), 'test');

      const result1 = await _streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );

      expect(result1).toContain('file1.txt');
      expect(result1).toContain('dir1/');
      expect(result1).toContain('  file2.txt');

      const start = Date.now();
      const result2 = await _streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );
      const duration = Date.now() - start;

      expect(result2).toBe(result1);
      expect(duration).toBeLessThan(50);
    });

    it('should handle cancellation', async () => {
      await fs.mkdir(path.join(testDir, 'dir1'));
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'test');

      const cancelToken: vscode.CancellationToken = {
        isCancellationRequested: true,
        onCancellationRequested: () => ({ dispose: () => {} }),
      };

      const result = await _streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        { ...defaultOptions, cancelToken },
      );

      expect(result).toBe('');
    });

    it('should process directories in parallel', async () => {
      const fileCount = 20;
      await Promise.all(
        Array.from({ length: fileCount }, (_, i) =>
          fs.writeFile(path.join(testDir, `file${i}.txt`), 'test'),
        ),
      );

      const result = await _streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );

      const fileLines = result.split('\n').filter(Boolean);
      expect(fileLines.length).toBe(fileCount);
      expect(fileLines[0]).toMatch(/file\d+\.txt/);
    });

    it('should handle dot folders correctly', async () => {
      await fs.mkdir(path.join(testDir, '.git'));
      await fs.mkdir(path.join(testDir, 'src'));
      await fs.writeFile(path.join(testDir, '.env'), 'test');
      await fs.writeFile(path.join(testDir, 'src/index.ts'), 'test');

      const hiddenResult = await _streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );

      expect(hiddenResult).not.toContain('.git');
      expect(hiddenResult).not.toContain('.env');
      expect(hiddenResult).toContain('src/');

      const visibleResult = await _streamingFileService.generateFileTree(
        testDir,
        testDir,
        true,
        defaultOptions,
      );

      expect(visibleResult).toContain('.git/');
      expect(visibleResult).toContain('.env');
      expect(visibleResult).toContain('src/');
    });

    it('should handle errors gracefully', async () => {
      const filePath = path.join(testDir, 'no-access.txt');
      await fs.writeFile(filePath, 'test');
      await fs.chmod(filePath, 0o000);

      const result = await _streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );

      expect(result).toContain('no-access.txt');
    });

    it('should handle moderate-sized files efficiently', async () => {
      const filePath = path.join(testDir, 'medium-file.txt');
      const content = Buffer.alloc(100 * 1024, 'x');
      await fs.writeFile(filePath, content);

      const beforeMemory = process.memoryUsage().heapUsed;
      await _streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );
      const afterMemory = process.memoryUsage().heapUsed;

      expect(afterMemory - beforeMemory).toBeLessThan(500 * 1024);
    });
  });
});
