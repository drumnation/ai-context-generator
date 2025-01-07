import * as path from 'path';
import { runTests } from '@vscode/test-electron';
import { cp } from 'fs/promises';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test script
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // The path to the test fixtures
    const fixturesPath = path.resolve(
      extensionDevelopmentPath,
      'test-fixtures',
    );
    const testWorkspacePath = path.resolve(
      extensionDevelopmentPath,
      '.vscode-test/workspace',
    );

    // Copy test fixtures to the test workspace
    try {
      await cp(fixturesPath, testWorkspacePath, { recursive: true });
      console.log('Successfully copied test fixtures to workspace');
    } catch (err) {
      console.error('Failed to copy test fixtures:', err);
      process.exit(1);
    }

    console.log('Test workspace path:', testWorkspacePath);
    console.log('Extension development path:', extensionDevelopmentPath);
    console.log('Extension tests path:', extensionTestsPath);

    // Ensure the extension is built before running tests
    console.log('Building extension...');
    await runTests({
      version: '1.89.0',
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        testWorkspacePath,
        '--disable-workspace-trust',
        '--enable-proposed-api=drumnation.ai-context-generator',
        '--skip-getting-started',
        '--skip-release-notes',
        '--user-data-dir=/tmp/vscode-test-workspace',
        '--verbose',
        '--disable-extensions', // Disable other extensions
        '--enable-proposed-api', // Enable all proposed APIs
        '--extensionDevelopmentPath=' + extensionDevelopmentPath, // Explicitly set development path
      ],
      extensionTestsEnv: {
        VSCODE_EXTENSION_DIRECTORY: extensionDevelopmentPath,
        VSCODE_EXTENSION_ID: 'drumnation.ai-context-generator',
      },
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
