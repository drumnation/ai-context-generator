import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra'; // Use fs-extra for easier dir handling
import * as assert from 'assert';
import * as sinon from 'sinon';
import { logger, LogLevel } from '../../shared/logger';
import { generateMarkdown } from '../../backend/services/markdownGenerator';
import { FileService } from '../../backend/services/fileService';
import { Container } from '../../di/container';
import {
  WebviewMessage,
  MessageAcknowledgment,
  MessageEnvelope,
  ProcessingStartedMessage,
  UpdateContentMessage,
} from '../../shared/types';

// Mock parts of vscode API needed for e2e context
jest.mock('vscode', () => {
  const actualVscode = jest.requireActual('vscode');
  return {
    ...actualVscode,
    ProgressLocation: {
      Notification: 1,
    },
    window: {
      ...actualVscode.window,
      withProgress: jest.fn(async (options, task) => {
        const progress = { report: jest.fn() };
        const token = {
          isCancellationRequested: false,
          onCancellationRequested: jest.fn(() => ({ dispose: jest.fn() })),
        };
        return await task(progress, token);
      }),
      createWebviewPanel: jest.fn(),
      showErrorMessage: jest.fn(),
      showWarningMessage: jest.fn(),
    },
    Uri: actualVscode.Uri,
    CancellationTokenSource: actualVscode.CancellationTokenSource,
  };
});

// --- Test Setup ---
const TEST_WORKSPACE_DIR = path.resolve(
  __dirname,
  '../../../temp/markdown-generation-e2e-tests',
);
const TEST_FOLDER_NAME = 'test-markdown-folder';
const TEST_FOLDER_PATH = path.join(TEST_WORKSPACE_DIR, TEST_FOLDER_NAME);

// Simplified Mock Panel for testing communication
interface MockPanel {
  webview: {
    postMessage: sinon.SinonStub;
    onDidReceiveMessage: sinon.SinonStub;
    // Internal test helper
    _triggerReceiveMessage(message: unknown): void;
    _getMessageCallbacks(): ((message: unknown) => void)[];
  };
  onDidDispose: sinon.SinonStub;
  dispose: sinon.SinonStub;
  reveal: sinon.SinonStub;
  // Simulate necessary properties from vscode.WebviewPanel
  readonly viewType: string;
  title: string;
  iconPath?: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri };
  readonly options: vscode.WebviewPanelOptions & vscode.WebviewOptions;
  readonly viewColumn?: vscode.ViewColumn;
  readonly active: boolean;
  readonly visible: boolean;
  readonly onDidChangeViewState: vscode.Event<vscode.WebviewPanelOnDidChangeViewStateEvent>;
}

function createMockPanel(): MockPanel {
  let messageCallbacks: ((message: unknown) => void)[] = [];
  const mockEmitter =
    new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>();

  return {
    webview: {
      postMessage: sinon.stub().resolves(true),
      onDidReceiveMessage: sinon
        .stub()
        .callsFake((callback: (message: unknown) => void) => {
          messageCallbacks.push(callback);
          return {
            dispose: () => {
              messageCallbacks = messageCallbacks.filter(
                (cb) => cb !== callback,
              );
            },
          };
        }),
      _triggerReceiveMessage(message: unknown) {
        messageCallbacks.forEach((cb) => cb(message));
      },
      _getMessageCallbacks() {
        return messageCallbacks;
      },
    },
    onDidDispose: sinon.stub(),
    dispose: sinon.stub(),
    reveal: sinon.stub(),
    // Mock required properties
    viewType: 'aiContext',
    title: 'AI-Context',
    options: { enableScripts: true, retainContextWhenHidden: true },
    viewColumn: vscode.ViewColumn.One,
    active: true,
    visible: true,
    onDidChangeViewState: mockEmitter.event,
  };
}

// Simplified Mock Context
interface MockContext {
  subscriptions: { dispose(): unknown }[];
  extensionUri: vscode.Uri;
  // Add other props if generateMarkdown actually uses them
}

// Use Mocha test structure
suite('Markdown Generation E2E Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let container: Container;
  let fileService: FileService;
  let mockPanel: MockPanel;
  let capturedMessages: MessageEnvelope<WebviewMessage>[] = [];
  let context: MockContext;

  // Mocha setup equivalent to beforeAll
  suiteSetup(async () => {
    logger.setLogLevel(LogLevel.INFO); // Ensure logs are captured
    // Ensure test directory is clean and exists
    await fs.remove(TEST_WORKSPACE_DIR);
    await fs.ensureDir(TEST_FOLDER_PATH);
    // Create some test files
    await fs.writeFile(path.join(TEST_FOLDER_PATH, 'file1.txt'), 'Hello World');
    await fs.writeFile(
      path.join(TEST_FOLDER_PATH, 'file2.js'),
      'console.log("Test");',
    );
    await fs.ensureDir(path.join(TEST_FOLDER_PATH, 'subdir'));
    await fs.writeFile(
      path.join(TEST_FOLDER_PATH, 'subdir', 'file3.ts'),
      'const x: number = 1;',
    );
  });

  // Mocha setup equivalent to beforeEach
  setup(() => {
    sandbox = sinon.createSandbox();
    container = new Container();
    fileService = new FileService(); // Use real file service
    mockPanel = createMockPanel();
    capturedMessages = [];

    // Create mock context with only necessary properties
    context = {
      subscriptions: [],
      extensionUri: vscode.Uri.file(path.resolve(__dirname, '../../..')),
    };

    // Mock container resolution
    container.register('fileService', fileService);
    container.register('webviewPanelService', {
      // Ensure the mock panel type matches what the service expects (or use `as any` if necessary)
      getOrCreateWebviewPanel: () =>
        mockPanel as unknown as vscode.WebviewPanel,
    });
    container.setContext(context as unknown as vscode.ExtensionContext); // Cast for registration

    // Capture messages sent TO the webview
    mockPanel.webview.postMessage.callsFake(
      async (message: MessageEnvelope<WebviewMessage>) => {
        logger.info('[E2E Test] Message sent to mock webview:', message);
        capturedMessages.push(message);
        return true;
      },
    );

    // Spy on logger to detect errors/warnings
    sandbox.spy(logger, 'error');
    sandbox.spy(logger, 'warn');
  });

  // Mocha teardown equivalent to afterEach
  teardown(() => {
    sandbox.restore();
    // Reset mocks if necessary, e.g., vscode.window mocks
    (vscode.window.withProgress as jest.Mock).mockClear();
    (vscode.window.showErrorMessage as jest.Mock).mockClear();
  });

  // Mocha teardown equivalent to afterAll
  suiteTeardown(async () => {
    // Cleanup test directory
    await fs.remove(TEST_WORKSPACE_DIR);
  });

  // --- Test Cases ---

  test('should successfully generate markdown and communicate with webview', async () => {
    // **Arrange**
    const targetDir = TEST_FOLDER_PATH;
    const isRoot = false;
    const includeDotFolders = false;

    // This callback simulates the logic within setupMessageHandler in the extension host
    const mockMessageHandler = (message: unknown) => {
      logger.info('[E2E Test] Mock extension host received message:', message);
      // Simulate MessageManager handling the ack
      if (
        typeof message === 'object' &&
        message !== null &&
        'command' in message &&
        message.command === 'messageAck'
      ) {
        // In a real test, we might spy on the actual MessageManager instance
        // For now, we just log it
        logger.info(
          `[E2E Test] Mock handler processing ack: ${(message as MessageAcknowledgment).id}`,
        );
      }
      // Add handling for other commands like 'fileTreeReceived' or 'heartbeatResponse' if needed for assertions
    };

    // Register the listener using the mock panel's stub
    mockPanel.webview.onDidReceiveMessage.callsFake(mockMessageHandler);

    // Simulate the webview acknowledging messages promptly
    const webviewAcks = (envelope: MessageEnvelope<WebviewMessage>) => {
      if (envelope.requiresAck) {
        const ack: MessageAcknowledgment = {
          command: 'messageAck',
          id: envelope.id,
          status: 'success',
        };
        // Simulate receiving the ack back in the extension host
        logger.info(`[E2E Test] Mock webview sending ack for ${envelope.id}`);
        // Use the internal trigger method on the mock panel
        mockPanel.webview._triggerReceiveMessage(ack);
      }
    };
    mockPanel.webview.postMessage.callsFake(
      async (message: MessageEnvelope<WebviewMessage>) => {
        logger.info('[E2E Test] Message sent to mock webview:', message);
        capturedMessages.push(message);
        // Simulate webview sending ack back immediately
        setImmediate(() => webviewAcks(message));
        return true;
      },
    );

    // **Act**
    logger.info('[E2E Test] Calling generateMarkdown...');
    await generateMarkdown(
      targetDir, // rootPath and directoryPath are the same for this test
      targetDir,
      context as unknown as vscode.ExtensionContext, // Cast for function call
      includeDotFolders,
      isRoot,
      fileService,
      container, // Pass the DI container
    );
    logger.info('[E2E Test] generateMarkdown call finished.');

    // **Assert**
    // 1. Check for absence of critical errors/warnings in logs
    const errorCalls = (logger.error as sinon.SinonSpy).getCalls();
    const warnCalls = (logger.warn as sinon.SinonSpy).getCalls();

    const errorMessages = errorCalls
      .map((call) => String(call.args[0]))
      .join('\n');
    const warnMessages = warnCalls
      .map((call) => String(call.args[0]))
      .join('\n');

    assert.ok(
      !errorMessages.includes('Timeout waiting'),
      `Timeout errors occurred: ${errorMessages}`,
    );
    assert.ok(
      !warnMessages.includes('heartbeat missed'),
      `Heartbeat warnings occurred: ${warnMessages}`,
    );
    assert.ok(
      !warnMessages.includes('unknown or timed out message'),
      `Unknown ack warnings occurred: ${warnMessages}`,
    );

    // 2. Check messages sent to the webview
    const processingStartedMsg = capturedMessages.find(
      (m) => m.payload.command === 'processingStarted',
    );
    assert.ok(processingStartedMsg, 'processingStarted message should be sent');
    // Use type assertion after finding the specific message type
    assert.strictEqual(
      (processingStartedMsg?.payload as ProcessingStartedMessage)?.loading,
      true,
      'loading should be true initially',
    );

    const updateContentMsg = capturedMessages.find(
      (m) => m.payload.command === 'updateContent',
    );
    assert.ok(updateContentMsg, 'updateContent message should be sent');
    // Use type assertion after finding the specific message type
    assert.ok(
      (updateContentMsg?.payload as UpdateContentMessage)?.fileTree,
      'updateContent should contain fileTree',
    );
    assert.ok(
      (updateContentMsg?.payload as UpdateContentMessage)?.combinedContent,
      'updateContent should contain combinedContent',
    );
    assert.strictEqual(
      (updateContentMsg?.payload as UpdateContentMessage)?.loading,
      false,
      'loading should be false finally',
    );

    // 3. Check acknowledgments were handled (implicitly by lack of errors)
    // More specific checks could involve spying on MessageManager.handleAcknowledgment
  });

  // TODO: Add a test case to specifically REPRODUCE the timeout failure
  // This would involve delaying the webview acknowledgment simulation
});
