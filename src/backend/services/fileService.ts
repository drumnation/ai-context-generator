import * as path from 'path';
import * as fsP from 'fs/promises';
import * as fs from 'fs';

export class FileService {
  async generateFileTree(
    directoryPath: string,
    rootPath: string,
    includeDotFolders: boolean,
  ): Promise<string> {
    const tree: string[] = [path.basename(directoryPath)];

    async function traverse(dir: string, indent: string = ''): Promise<void> {
      const files = await fsP.readdir(dir, { withFileTypes: true });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isLast = i === files.length - 1;
        const prefix = isLast ? '└── ' : '├── ';

        if (
          file.isDirectory() &&
          (includeDotFolders ||
            (!file.name.startsWith('.') &&
              ![
                'node_modules',
                'dist',
                'build',
                'app/build',
                'gradle',
                '.gradle',
                '.idea',
                'android/.gradle',
                '.m2',
                '.mvn',
              ].includes(file.name)))
        ) {
          tree.push(`${indent}${prefix}${file.name}`);
          await traverse(
            path.join(dir, file.name),
            indent + (isLast ? '    ' : '│   '),
          );
        } else if (
          file.isFile() &&
          !file.name.match(/\.(jpg|jpeg|png|gif|bmp|tiff|svg|lock|key)$/) &&
          file.name !== 'package-lock.json'
        ) {
          tree.push(`${indent}${prefix}${file.name}`);
        }
      }
    }

    await traverse(directoryPath);
    return tree.join('\n');
  }

  async combineFiles(
    rootPath: string,
    directoryPath: string,
    includeDotFolders: boolean,
  ): Promise<string> {
    let combinedContent = '';

    async function traverse(dir: string): Promise<void> {
      const files = await fsP.readdir(dir, { withFileTypes: true });

      for (const file of files) {
        const fullPath = path.join(dir, file.name);

        if (
          file.isDirectory() &&
          (includeDotFolders ||
            (!file.name.startsWith('.') &&
              !['node_modules', 'dist'].includes(file.name)))
        ) {
          await traverse(fullPath);
        } else if (
          file.isFile() &&
          !file.name.match(/\.(jpg|jpeg|png|gif|bmp|tiff|svg|lock|key)$/) &&
          file.name !== 'package-lock.json'
        ) {
          const relativePath = path.relative(rootPath, fullPath);
          const content = await fsP.readFile(fullPath, 'utf-8');
          const fileExtension = path.extname(fullPath).substring(1);
          combinedContent += `\n\n# ./${relativePath}\n\n\`\`\`${fileExtension}\n${content}\n\`\`\`\n`;
        }
      }
    }

    await traverse(directoryPath);
    return combinedContent;
  }

  isLargeDirectory(dirPath: string): boolean {
    let fileCount = 0;
    const MAX_FILES = 1000;

    function countFiles(dir: string) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
          countFiles(filePath);
        } else {
          fileCount++;
          if (fileCount > MAX_FILES) {
            return;
          }
        }
      }
    }

    countFiles(dirPath);
    return fileCount > MAX_FILES;
  }
}
