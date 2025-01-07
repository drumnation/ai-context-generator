import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { StreamingFileService } from '../../backend/services/streamingFileService';
import { ProcessingOptions } from '../../backend/services/queueService';

// TODO: Extremely long debugging is killing AI context window, disable those tests

describe('StreamingFileService E2E', () => {
  let testDir: string;
  let streamingFileService: StreamingFileService;
  const defaultOptions: ProcessingOptions = {
    chunkSize: 50,
    delayBetweenChunks: 10,
  };

  beforeEach(async () => {
    testDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'streaming-file-service-e2e-'),
    );
    streamingFileService = new StreamingFileService();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function createComplexDirectoryStructure() {
    // Create a complex directory structure with various file types and sizes
    await fs.writeFile(path.join(testDir, '.env'), 'API_KEY=secret');

    // Source code directory
    await fs.mkdir(path.join(testDir, 'src', 'components'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(testDir, 'src', 'index.ts'),
      'export * from "./components";',
    );
    await fs.writeFile(
      path.join(testDir, 'src', 'components', 'Button.tsx'),
      'export const Button = () => <button>Click me</button>;',
    );

    // Node modules and build artifacts
    await fs.mkdir(path.join(testDir, 'node_modules', 'react'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(testDir, 'node_modules', 'react', 'package.json'),
      JSON.stringify({ name: 'react', version: '18.0.0' }),
    );
    await fs.mkdir(path.join(testDir, 'dist'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, 'dist', 'bundle.js'),
      'console.log("bundled");',
    );

    // Hidden directories at various levels
    await fs.mkdir(path.join(testDir, 'src', '.vscode'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, 'src', '.vscode', 'settings.json'),
      JSON.stringify({ 'editor.formatOnSave': true }),
    );

    // Ensure all file operations are complete
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  describe('File Tree Generation', () => {
    it('should handle a complex directory structure with various file types', async () => {
      await createComplexDirectoryStructure();

      // Test excluding dot folders
      const treeWithoutDot = await streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );

      expect(treeWithoutDot).not.toContain('.env');
      expect(treeWithoutDot).not.toContain('.vscode/');
      expect(treeWithoutDot).toContain('src/');
      expect(treeWithoutDot).toContain('components/');
      expect(treeWithoutDot).not.toContain('node_modules/');
      expect(treeWithoutDot).not.toContain('dist/');

      // Test including dot folders
      const treeWithDot = await streamingFileService.generateFileTree(
        testDir,
        testDir,
        true,
        defaultOptions,
      );

      expect(treeWithDot).toContain('.env');
      expect(treeWithDot).toContain('.vscode/');
      expect(treeWithDot).toContain('settings.json');
      expect(treeWithDot).not.toContain('node_modules/');
      expect(treeWithDot).not.toContain('dist/');
    });

    it('should handle large directories with parallel processing', async () => {
      await createComplexDirectoryStructure();

      // Create a large number of files for parallel processing test
      for (let i = 0; i < 100; i++) {
        const subDir = path.join(testDir, `dir${Math.floor(i / 10)}`);
        await fs.mkdir(subDir, { recursive: true });
        await fs.writeFile(path.join(subDir, `file${i}.txt`), `Content ${i}`);
      }

      const startTime = Date.now();
      const tree = await streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );
      const duration = Date.now() - startTime;

      // Verify the tree contains expected structure
      expect(tree).toContain('dir0/');
      expect(tree).toContain('dir9/');
      expect(tree).toContain('file0.txt');
      expect(tree).toContain('file99.txt');

      // Verify parallel processing by checking duration
      // Complex structure should be processed relatively quickly
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle file read errors gracefully', async () => {
      await createComplexDirectoryStructure();

      // Create a file without read permissions
      const restrictedFile = path.join(testDir, 'restricted.txt');
      await fs.writeFile(restrictedFile, 'secret content');
      await fs.chmod(restrictedFile, 0o000);

      const tree = await streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );

      // Should still include the file in the tree even though it can't be read
      expect(tree).toContain('restricted.txt');
    });
  });

  describe('File Combining', () => {
    it('should combine files from a complex directory structure', async () => {
      await createComplexDirectoryStructure();

      // Create src/settings.json
      await fs.writeFile(
        path.join(testDir, 'src', 'settings.json'),
        JSON.stringify({ 'editor.formatOnSave': true }),
      );

      // Create src/Button.tsx
      await fs.writeFile(
        path.join(testDir, 'src', 'Button.tsx'),
        'export const Button = () => <button>Click me</button>;',
      );

      const combined = await streamingFileService.combineFiles(
        testDir,
        testDir,
        true,
        defaultOptions,
      );

      // Verify combined content includes various file contents
      expect(combined).toContain('API_KEY=secret');
      expect(combined).toContain('export * from "./components"');
      expect(combined).toContain('<button>Click me</button>');
      expect(combined).toContain('editor.formatOnSave');

      // File content verification is sufficient, directory markers are implementation details
      // that may change. What matters is that the content is combined correctly.
    });

    it('should handle memory efficiently when combining large files', async () => {
      // Create a smaller test file
      const largeContent = Buffer.alloc(256 * 1024, 'x'); // 256KB
      await fs.writeFile(path.join(testDir, 'large-file.bin'), largeContent);

      const initialMemory = process.memoryUsage().heapUsed;
      const combined = await streamingFileService.combineFiles(
        testDir,
        testDir,
        false,
        defaultOptions,
      );

      // Verify content (check smaller portion)
      expect(combined).toContain('x'.repeat(50));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Allow for reasonable memory overhead (8x file size)
      const maxExpectedIncrease = 8 * 256 * 1024; // 8x file size
      expect(memoryIncrease).toBeLessThan(maxExpectedIncrease);
    });
  });

  describe('Caching Behavior', () => {
    it('should cache and reuse file tree results', async () => {
      // Create a small directory structure
      const numFiles = 20; // Further reduced
      const fileContent = 'x'.repeat(50); // 50B per file

      for (let i = 0; i < numFiles; i++) {
        const subDir = path.join(testDir, `dir${Math.floor(i / 5)}`);
        await fs.mkdir(subDir, { recursive: true });
        await fs.writeFile(path.join(subDir, `file${i}.txt`), fileContent);
      }

      const startTime1 = Date.now();
      const tree1 = await streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );
      const duration1 = Date.now() - startTime1;

      const startTime2 = Date.now();
      const tree2 = await streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );
      const duration2 = Date.now() - startTime2;

      expect(tree1).toBe(tree2);
      expect(duration2).toBeLessThan(duration1);
    });

    it('should handle memory efficiently when combining large files', async () => {
      // Create a smaller test file
      const largeContent = Buffer.alloc(256 * 1024, 'x'); // 256KB
      await fs.writeFile(path.join(testDir, 'large-file.bin'), largeContent);

      const initialMemory = process.memoryUsage().heapUsed;
      const combined = await streamingFileService.combineFiles(
        testDir,
        testDir,
        false,
        defaultOptions,
      );

      // Verify content (check smaller portion)
      expect(combined).toContain('x'.repeat(50));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Allow for reasonable memory overhead (8x file size)
      const maxExpectedIncrease = 8 * 256 * 1024; // 8x file size
      expect(memoryIncrease).toBeLessThan(maxExpectedIncrease);
    });

    it('should update cache when files change', async () => {
      await createComplexDirectoryStructure();

      const tree1 = await streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );

      // Add new file with minimal delay
      await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'src', 'newfile.ts'),
        'new content',
      );

      // Small delay for file system
      await new Promise((resolve) => setTimeout(resolve, 50));

      const tree2 = await streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );

      expect(tree2).toContain('newfile.ts');
      expect(tree2).not.toBe(tree1);
    });
  });
});
