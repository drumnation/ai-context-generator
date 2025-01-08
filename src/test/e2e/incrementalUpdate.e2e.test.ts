import * as assert from 'assert';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { IncrementalUpdateService } from '../../backend/services/incrementalUpdateService';
import { ProgressService } from '../../backend/services/progressService';
import { ProcessingOptions } from '../../backend/services/queueService';

describe('Incremental Update E2E Tests', () => {
  // Set timeout for all tests in this describe block
  jest.setTimeout(10000); // Some operations might be slow

  const testDir = path.join(__dirname, 'test-files');
  const file1Path = path.join(testDir, 'file1.txt');
  const file2Path = path.join(testDir, 'file2.txt');
  let service: IncrementalUpdateService;

  beforeEach(async () => {
    // Setup test directory
    await fsPromises.mkdir(testDir, { recursive: true });
    await fsPromises.writeFile(file1Path, 'Initial content 1');
    await fsPromises.writeFile(file2Path, 'Initial content 2');

    service = new IncrementalUpdateService(new ProgressService(), {
      include: ['**/*'],
      exclude: [],
    });
  });

  afterEach(async () => {
    // Cleanup
    await fsPromises.rm(testDir, { recursive: true, force: true });
  });

  describe('File Detection', () => {
    it('should detect changes incrementally', async () => {
      // Initial detection
      const options: ProcessingOptions = {
        chunkSize: 10,
        delayBetweenChunks: 0,
      };
      const initialResult = await service.detectChanges(testDir, [], options);
      assert.ok(initialResult.files.includes(file1Path));
      assert.ok(initialResult.files.includes(file2Path));
      assert.strictEqual(initialResult.added.length, 2);
      assert.strictEqual(initialResult.removed.length, 0);
      assert.strictEqual(initialResult.unchanged.length, 0);

      // No changes - should detect no changes
      const unchangedResult = await service.detectChanges(
        testDir,
        initialResult.files,
        options,
      );
      assert.strictEqual(unchangedResult.added.length, 0);
      assert.strictEqual(unchangedResult.removed.length, 0);
      assert.strictEqual(unchangedResult.unchanged.length, 2);

      // Add new file
      const file3Path = path.join(testDir, 'file3.txt');
      await fsPromises.writeFile(file3Path, 'New content');
      const addedResult = await service.detectChanges(
        testDir,
        initialResult.files,
        options,
      );
      assert.ok(addedResult.added.includes(file3Path));
      assert.strictEqual(addedResult.added.length, 1);
      assert.strictEqual(addedResult.removed.length, 0);
      assert.strictEqual(addedResult.unchanged.length, 2);

      // Modify existing file
      await fsPromises.writeFile(file1Path, 'Modified content');
      const modifiedResult = await service.detectChanges(
        testDir,
        addedResult.files,
        options,
      );
      assert.ok(modifiedResult.files.includes(file1Path));
      assert.strictEqual(modifiedResult.added.length, 0);
      assert.strictEqual(modifiedResult.removed.length, 0);
      assert.strictEqual(modifiedResult.unchanged.length, 3);

      // Delete file
      await fsPromises.unlink(file2Path);
      const deletedResult = await service.detectChanges(
        testDir,
        modifiedResult.files,
        options,
      );
      assert.ok(!deletedResult.files.includes(file2Path));
      assert.ok(deletedResult.removed.includes(file2Path));
      assert.strictEqual(deletedResult.added.length, 0);
      assert.strictEqual(deletedResult.removed.length, 1);
      assert.strictEqual(deletedResult.unchanged.length, 2);
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
        await service.detectChanges(inaccessibleDir, [], options);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }

      // Cleanup
      await fsPromises.chmod(inaccessibleDir, 0o777);
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
      const result1 = await service.detectChanges(testDir, [], options);
      const duration1 = Date.now() - start1;

      // Second run (should be faster)
      const start2 = Date.now();
      const _result2 = await service.detectChanges(
        testDir,
        result1.files,
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
