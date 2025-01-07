import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';
import * as vscode from 'vscode';

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: 60000,
    reporter: 'spec',
  });

  const testsRoot = path.resolve(__dirname);
  console.log('Test root directory:', testsRoot);

  try {
    // Wait for extension to activate
    console.log('Waiting for extension to activate...');
    let ext = vscode.extensions.getExtension('drumnation.ai-context-generator');
    let retries = 0;
    const maxRetries = 30;

    while (!ext && retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      ext = vscode.extensions.getExtension('drumnation.ai-context-generator');
      retries++;
      console.log(
        `Attempt ${retries}: ${ext ? 'Extension found' : 'Extension not found'}`,
      );
    }

    if (!ext) {
      throw new Error('Extension not found after 30 seconds');
    }

    if (!ext.isActive) {
      console.log('Activating extension...');
      try {
        await ext.activate();
        console.log('Extension activated successfully');
      } catch (error) {
        console.error('Failed to activate extension:', error);
        throw error;
      }
    } else {
      console.log('Extension is already active');
    }

    // Use a more specific pattern to find test files
    const files = await glob('**/*.test.{js,ts}', {
      cwd: testsRoot,
      absolute: true,
    });

    console.log('Found test files:', files);

    // Add files to the test suite
    files.forEach((f) => {
      console.log('Adding test file:', f);
      mocha.addFile(f);
    });

    // Run the mocha test
    return new Promise((resolve, reject) => {
      try {
        mocha.run((failures: number) => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (err) {
        console.error('Error running tests:', err);
        reject(err);
      }
    });
  } catch (err) {
    console.error('Error setting up tests:', err);
    throw new Error(`Error while running tests: ${err}`);
  }
}
