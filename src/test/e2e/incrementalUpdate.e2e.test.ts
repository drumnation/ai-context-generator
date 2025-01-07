import * as assert from 'assert';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { StreamingFileService } from '../../backend/services/streamingFileService';
import { ProcessingOptions } from '../../backend/services/queueService';

describe('Incremental Update E2E Tests', () => {
  // Set timeout for all tests in this describe block
  jest.setTimeout(10000); // Some operations might be slow

  const testDir = path.join(__dirname, 'test-files');
  const file1Path = path.join(testDir, 'file1.txt');
  const file2Path = path.join(testDir, 'file2.txt');
  let service: StreamingFileService;

  beforeEach(async () => {
    // Setup test directory
    await fsPromises.mkdir(testDir, { recursive: true });
    await fsPromises.writeFile(file1Path, 'Initial content 1');
    await fsPromises.writeFile(file2Path, 'Initial content 2');

    service = new StreamingFileService();
  });

  afterEach(async () => {
    // Cleanup
    await fsPromises.rm(testDir, { recursive: true, force: true });
  });

  describe('File Tree Generation', () => {
    it('should generate tree incrementally', async () => {
      // Initial tree generation
      const options: ProcessingOptions = {
        chunkSize: 10,
        delayBetweenChunks: 0,
      };
      const initialTree = await service.generateFileTreeIncremental(
        testDir,
        testDir,
        true,
        options,
      );
      assert.ok(initialTree.includes('file1.txt'));
      assert.ok(initialTree.includes('file2.txt'));

      // No changes - should use cache
      const unchangedTree = await service.generateFileTreeIncremental(
        testDir,
        testDir,
        true,
        options,
      );
      assert.strictEqual(unchangedTree, initialTree);

      // Add new file
      const file3Path = path.join(testDir, 'file3.txt');
      await fsPromises.writeFile(file3Path, 'New content');
      const treeWithNewFile = await service.generateFileTreeIncremental(
        testDir,
        testDir,
        true,
        options,
      );
      assert.ok(treeWithNewFile.includes('file3.txt'));

      // Modify existing file
      await fsPromises.writeFile(file1Path, 'Modified content');
      const treeAfterModification = await service.generateFileTreeIncremental(
        testDir,
        testDir,
        true,
        options,
      );
      assert.ok(treeAfterModification.includes('file1.txt'));

      // Delete file
      await fsPromises.unlink(file2Path);
      const treeAfterDeletion = await service.generateFileTreeIncremental(
        testDir,
        testDir,
        true,
        options,
      );
      assert.ok(!treeAfterDeletion.includes('file2.txt'));
    });
  });

  describe('File Combining', () => {
    it('should combine files incrementally', async () => {
      const options: ProcessingOptions = {
        chunkSize: 10,
        delayBetweenChunks: 0,
      };

      // Initial combination
      const initialContent = await service.combineFilesIncremental(
        testDir,
        testDir,
        true,
        options,
      );
      assert.ok(initialContent.includes('Initial content 1'));
      assert.ok(initialContent.includes('Initial content 2'));

      // No changes - should use cache
      const unchangedContent = await service.combineFilesIncremental(
        testDir,
        testDir,
        true,
        options,
      );
      assert.strictEqual(unchangedContent, initialContent);

      // Add new file
      const file3Path = path.join(testDir, 'file3.txt');
      await fsPromises.writeFile(file3Path, 'New content');
      const contentWithNewFile = await service.combineFilesIncremental(
        testDir,
        testDir,
        true,
        options,
      );
      assert.ok(contentWithNewFile.includes('New content'));

      // Modify existing file
      await fsPromises.writeFile(file1Path, 'Modified content');
      const contentAfterModification = await service.combineFilesIncremental(
        testDir,
        testDir,
        true,
        options,
      );
      assert.ok(contentAfterModification.includes('Modified content'));
      assert.ok(!contentAfterModification.includes('Initial content 1'));

      // Delete file
      await fsPromises.unlink(file2Path);
      const contentAfterDeletion = await service.combineFilesIncremental(
        testDir,
        testDir,
        true,
        options,
      );
      assert.ok(!contentAfterDeletion.includes('Initial content 2'));
    });
  });

  describe('Error Handling', () => {
    it('should handle inaccessible directories', async () => {
      const inaccessibleDir = path.join(testDir, 'no-access');
      await fsPromises.mkdir(inaccessibleDir, { recursive: true });
      await fsPromises.chmod(inaccessibleDir, 0o000);

      const options: ProcessingOptions = {
        chunkSize: 10,
        delayBetweenChunks: 0,
      };

      try {
        await service.generateFileTreeIncremental(
          inaccessibleDir,
          inaccessibleDir,
          true,
          options,
        );
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }

      // Cleanup
      await fsPromises.chmod(inaccessibleDir, 0o777);
    });

    it('should handle file read errors', async () => {
      // Create an unreadable file
      const unreadableFile = path.join(testDir, 'unreadable.txt');
      await fsPromises.writeFile(unreadableFile, 'Some content');
      await fsPromises.chmod(unreadableFile, 0o000);

      const options: ProcessingOptions = {
        chunkSize: 10,
        delayBetweenChunks: 0,
      };

      try {
        await service.combineFilesIncremental(testDir, testDir, true, options);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }

      // Cleanup
      await fsPromises.chmod(unreadableFile, 0o777);
    });
  });

  describe('Performance', () => {
    it('should be faster on subsequent runs with no changes', async () => {
      const options: ProcessingOptions = {
        chunkSize: 10,
        delayBetweenChunks: 0,
      };

      // Create more test files
      for (let i = 0; i < 10; i++) {
        await fsPromises.writeFile(
          path.join(testDir, `perf-test-${i}.txt`),
          `Content ${i}`,
        );
      }

      // First run
      const start1 = Date.now();
      await service.generateFileTreeIncremental(
        testDir,
        testDir,
        true,
        options,
      );
      const duration1 = Date.now() - start1;

      // Second run (should use cache)
      const start2 = Date.now();
      await service.generateFileTreeIncremental(
        testDir,
        testDir,
        true,
        options,
      );
      const duration2 = Date.now() - start2;

      assert.ok(
        duration2 < duration1,
        `Second run (${duration2}ms) should be faster than first run (${duration1}ms)`,
      );
    });
  });
});
