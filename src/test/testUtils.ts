import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Creates a temporary directory for testing
 * @param prefix Prefix for the temp directory name
 * @returns Path to the created temp directory
 */
export async function createTempDir(prefix: string): Promise<string> {
  const tempPath = path.join(os.tmpdir(), `${prefix}-${Date.now()}`);
  await fs.mkdir(tempPath, { recursive: true });
  return tempPath;
}

/**
 * Removes a temporary directory and all its contents
 * @param dirPath Path to the directory to remove
 */
export async function removeTempDir(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
}

/**
 * Creates a delay for the specified number of milliseconds
 * @param ms Number of milliseconds to delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
