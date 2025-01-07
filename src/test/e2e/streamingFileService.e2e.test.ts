import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { StreamingFileService } from '../../backend/services/streamingFileService';
import { ProcessingOptions } from '../../backend/services/queueService';

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
    await fs.mkdir(path.join(testDir, '.git'));
    await fs.writeFile(
      path.join(testDir, '.git', 'config'),
      'git config content',
    );
    await fs.writeFile(path.join(testDir, '.env'), 'API_KEY=secret');

    // Source code directory
    await fs.mkdir(path.join(testDir, 'src'));
    await fs.mkdir(path.join(testDir, 'src', 'components'));
    await fs.writeFile(
      path.join(testDir, 'src', 'index.ts'),
      'export * from "./components";',
    );
    await fs.writeFile(
      path.join(testDir, 'src', 'components', 'Button.tsx'),
      'export const Button = () => <button>Click me</button>;',
    );

    // Node modules and build artifacts
    await fs.mkdir(path.join(testDir, 'node_modules'));
    await fs.mkdir(path.join(testDir, 'node_modules', 'react'));
    await fs.writeFile(
      path.join(testDir, 'node_modules', 'react', 'package.json'),
      JSON.stringify({ name: 'react', version: '18.0.0' }),
    );
    await fs.mkdir(path.join(testDir, 'dist'));
    await fs.writeFile(
      path.join(testDir, 'dist', 'bundle.js'),
      'console.log("bundled");',
    );

    // Large file
    const largeContent = Buffer.alloc(5 * 1024 * 1024, 'x');
    await fs.writeFile(path.join(testDir, 'large-file.bin'), largeContent);

    // Deeply nested directories
    let currentPath = path.join(testDir, 'deep');
    for (let i = 0; i < 10; i++) {
      currentPath = path.join(currentPath, `level${i}`);
      await fs.mkdir(currentPath, { recursive: true });
      await fs.writeFile(
        path.join(currentPath, `file${i}.txt`),
        `Content at level ${i}`,
      );
    }

    // Hidden directories at various levels
    await fs.mkdir(path.join(testDir, 'src', '.vscode'));
    await fs.writeFile(
      path.join(testDir, 'src', '.vscode', 'settings.json'),
      JSON.stringify({ 'editor.formatOnSave': true }),
    );
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

      expect(treeWithoutDot).not.toContain('.git/');
      expect(treeWithoutDot).not.toContain('.env');
      expect(treeWithoutDot).not.toContain('.vscode/');
      expect(treeWithoutDot).toContain('src/');
      expect(treeWithoutDot).toContain('components/');
      expect(treeWithoutDot).toContain('deep/');
      expect(treeWithoutDot).not.toContain('node_modules/');
      expect(treeWithoutDot).not.toContain('dist/');

      // Test including dot folders
      const treeWithDot = await streamingFileService.generateFileTree(
        testDir,
        testDir,
        true,
        defaultOptions,
      );

      expect(treeWithDot).toContain('.git/');
      expect(treeWithDot).toContain('.env');
      expect(treeWithDot).toContain('.vscode/');
      expect(treeWithDot).toContain('settings.json');
      expect(treeWithDot).not.toContain('node_modules/');
      expect(treeWithDot).not.toContain('dist/');
    });

    it('should handle large directories with parallel processing', async () => {
      await createComplexDirectoryStructure();

      const startTime = Date.now();
      const tree = await streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );
      const duration = Date.now() - startTime;

      // Verify the tree contains expected deep structure
      for (let i = 0; i < 10; i++) {
        expect(tree).toContain(`level${i}/`);
        expect(tree).toContain(`file${i}.txt`);
      }

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

      const combined = await streamingFileService.combineFiles(
        testDir,
        testDir,
        true,
        defaultOptions,
      );

      // Verify combined content includes various file contents
      expect(combined).toContain('git config content');
      expect(combined).toContain('API_KEY=secret');
      expect(combined).toContain('export * from "./components"');
      expect(combined).toContain('<button>Click me</button>');
      expect(combined).toContain('"editor.formatOnSave": true');

      // Verify directory markers are present
      expect(combined).toContain('// Directory: src');
      expect(combined).toContain('// Directory: components');
      expect(combined).toContain('// File: src/index.ts');
    });

    it('should handle memory efficiently when combining large files', async () => {
      await createComplexDirectoryStructure();

      const initialMemory = process.memoryUsage().heapUsed;
      await streamingFileService.combineFiles(
        testDir,
        testDir,
        false,
        defaultOptions,
      );
      const finalMemory = process.memoryUsage().heapUsed;

      // Memory increase should be reasonable despite 5MB file
      const memoryIncrease = finalMemory - initialMemory;
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    });
  });

  describe('Caching Behavior', () => {
    it('should cache and reuse file tree results', async () => {
      await createComplexDirectoryStructure();

      // First call - should generate tree
      const startTime1 = Date.now();
      const tree1 = await streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );
      const duration1 = Date.now() - startTime1;

      // Second call - should use cache
      const startTime2 = Date.now();
      const tree2 = await streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );
      const duration2 = Date.now() - startTime2;

      expect(tree1).toBe(tree2);
      expect(duration2).toBeLessThan(duration1 * 0.5); // Cache access should be at least 50% faster
    });

    it('should update cache when files change', async () => {
      await createComplexDirectoryStructure();

      // Get initial tree
      const tree1 = await streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );

      // Add new file
      await fs.writeFile(
        path.join(testDir, 'src', 'newfile.ts'),
        'new content',
      );

      // Get updated tree
      const tree2 = await streamingFileService.generateFileTree(
        testDir,
        testDir,
        false,
        defaultOptions,
      );

      expect(tree2).not.toBe(tree1);
      expect(tree2).toContain('newfile.ts');
    });
  });
});
