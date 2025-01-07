import { Container } from '../container';
import {
  FileService,
  PerformanceService,
  WebviewPanelProvider,
} from '../types';
import mockVSCode, {
  Disposable,
  Memento,
  SecretStorage,
  SecretStorageChangeEvent,
  EnvironmentVariableMutator,
  EnvironmentVariableCollection,
  EnvironmentVariableScope,
  WebviewPanel,
} from '../../test/vscode.mock';
import * as vscode from 'vscode';

// Mock VSCode EventEmitter
class MockEventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  fire(data: T): void {
    this.listeners.forEach((listener) => listener(data));
  }

  event = (listener: (e: T) => void): Disposable => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
          this.listeners.splice(index, 1);
        }
      },
    };
  };
}

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('register', () => {
    it('should register a service with a string key', () => {
      const mockService = { test: 'service' };
      container.register('testService', mockService);
      expect(container.resolve('testService')).toBe(mockService);
    });

    it('should register a typed service from ServiceMap', () => {
      const mockFileService: FileService = {
        generateFileTree: jest.fn(),
        combineFiles: jest.fn(),
        isLargeDirectory: jest.fn(),
      };
      container.register('fileService', mockFileService);
      expect(container.resolve('fileService')).toBe(mockFileService);
    });

    it('should allow overwriting an existing service', () => {
      const mockService1 = { test: 'service1' };
      const mockService2 = { test: 'service2' };

      container.register('testService', mockService1);
      container.register('testService', mockService2);

      expect(container.resolve('testService')).toBe(mockService2);
    });
  });

  describe('resolve', () => {
    it('should resolve a registered service', () => {
      const mockService = { test: 'service' };
      container.register('testService', mockService);
      expect(container.resolve('testService')).toBe(mockService);
    });

    it('should throw error when resolving unregistered service', () => {
      expect(() => container.resolve('nonexistentService')).toThrow(
        "Service 'nonexistentService' not found in container",
      );
    });

    it('should resolve typed services with correct types', () => {
      const mockPerformanceService: PerformanceService = {
        startOperation: jest.fn(),
        endOperation: jest.fn(),
        profileDirectoryScanning: jest.fn(),
        getMetrics: jest.fn(),
        clearMetrics: jest.fn(),
      };

      container.register('performanceService', mockPerformanceService);
      const resolved = container.resolve('performanceService');

      expect(resolved).toBe(mockPerformanceService);
      expect(resolved.startOperation).toBeDefined();
      expect(resolved.endOperation).toBeDefined();
    });
  });

  describe('integration', () => {
    it('should handle complex service dependencies', () => {
      // Create mock objects
      const mockMemento = new MockMemento();
      const mockSecrets = new MockSecrets();
      const mockEnvVarCollection = new MockEnvironmentVariableCollection();
      const mockLanguageModelEventEmitter = new MockEventEmitter<void>();

      // Mock vscode.ExtensionContext
      const mockContext = {
        subscriptions: [],
        extensionPath: '/test/path',
        extensionUri: mockVSCode.Uri.file('/test/path'),
        globalState: mockMemento,
        workspaceState: mockMemento,
        secrets: mockSecrets,
        storageUri: mockVSCode.Uri.file('/test/storage'),
        globalStorageUri: mockVSCode.Uri.file('/test/global-storage'),
        logUri: mockVSCode.Uri.file('/test/log'),
        extensionMode: mockVSCode.ExtensionMode.Development,
        environmentVariableCollection: mockEnvVarCollection,
        asAbsolutePath: jest.fn((path: string) => path),
        storagePath: '/test/storage-path',
        globalStoragePath: '/test/global-storage-path',
        logPath: '/test/log-path',
        extension: {
          id: 'test.extension',
          extensionUri: mockVSCode.Uri.file('/test/path'),
          extensionPath: '/test/path',
          isActive: true,
          packageJSON: {},
          exports: undefined,
          activate: jest.fn(),
          extensionKind: mockVSCode.ExtensionKind.Workspace,
        },
        languageModelAccessInformation: {
          keyExpiresAt: undefined,
          keyId: undefined,
          onDidChange: mockLanguageModelEventEmitter.event,
          canSendRequest: jest.fn().mockReturnValue(true),
        },
      } as unknown as vscode.ExtensionContext;

      // Setup mock services
      const mockFileService: FileService = {
        generateFileTree: jest.fn(),
        combineFiles: jest.fn(),
        isLargeDirectory: jest.fn(),
      };

      const mockPerformanceService: PerformanceService = {
        startOperation: jest.fn(),
        endOperation: jest.fn(),
        profileDirectoryScanning: jest.fn(),
        getMetrics: jest.fn(),
        clearMetrics: jest.fn(),
      };

      const mockWebviewPanel = {
        webview: {},
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
      } as WebviewPanel;

      const mockWebviewPanelProvider: WebviewPanelProvider = {
        getOrCreateWebviewPanel: jest.fn().mockReturnValue(mockWebviewPanel),
      };

      // Register all services
      container.register('fileService', mockFileService);
      container.register('performanceService', mockPerformanceService);
      container.register('webviewPanelService', mockWebviewPanelProvider);

      // Verify all services can be resolved
      expect(container.resolve('fileService')).toBe(mockFileService);
      expect(container.resolve('performanceService')).toBe(
        mockPerformanceService,
      );
      expect(container.resolve('webviewPanelService')).toBe(
        mockWebviewPanelProvider,
      );

      // Test service interaction
      const webviewService = container.resolve('webviewPanelService');
      const panel = webviewService.getOrCreateWebviewPanel(
        mockContext,
        container,
      );

      expect(panel).toBe(mockWebviewPanel);
      expect(webviewService.getOrCreateWebviewPanel).toHaveBeenCalledWith(
        mockContext,
        container,
      );
    });
  });
});

// Mock implementations
class MockMemento implements Memento {
  private storage = new Map<string, unknown>();

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get(key: string, defaultValue?: unknown) {
    return this.storage.get(key) ?? defaultValue;
  }

  update(key: string, value: unknown): Thenable<void> {
    this.storage.set(key, value);
    return Promise.resolve();
  }

  setKeysForSync(): void {}

  keys(): readonly string[] {
    return Array.from(this.storage.keys());
  }
}

class MockSecrets implements SecretStorage {
  private secrets = new Map<string, string>();
  private eventEmitter = new MockEventEmitter<SecretStorageChangeEvent>();

  get(key: string): Thenable<string | undefined> {
    return Promise.resolve(this.secrets.get(key));
  }

  store(key: string, value: string): Thenable<void> {
    this.secrets.set(key, value);
    this.eventEmitter.fire({ key });
    return Promise.resolve();
  }

  delete(key: string): Thenable<void> {
    this.secrets.delete(key);
    this.eventEmitter.fire({ key });
    return Promise.resolve();
  }

  onDidChange = this.eventEmitter.event;
}

class MockEnvironmentVariableCollection
  implements EnvironmentVariableCollection
{
  persistent = true;
  description = 'Mock Environment Variable Collection';

  private envVars = new Map<string, EnvironmentVariableMutator>();

  replace(variable: string, value: string): void {
    this.envVars.set(variable, {
      value,
      type: mockVSCode.EnvironmentVariableMutatorType.Replace,
      options: { applyAtProcessCreation: true },
    });
  }

  append(variable: string, value: string): void {
    this.envVars.set(variable, {
      value,
      type: mockVSCode.EnvironmentVariableMutatorType.Append,
      options: { applyAtProcessCreation: true },
    });
  }

  prepend(variable: string, value: string): void {
    this.envVars.set(variable, {
      value,
      type: mockVSCode.EnvironmentVariableMutatorType.Prepend,
      options: { applyAtProcessCreation: true },
    });
  }

  get(variable: string): EnvironmentVariableMutator | undefined {
    return this.envVars.get(variable);
  }

  forEach(
    callback: (
      variable: string,
      mutator: EnvironmentVariableMutator,
      collection: EnvironmentVariableCollection,
    ) => void,
  ): void {
    this.envVars.forEach((mutator, variable) =>
      callback(variable, mutator, this),
    );
  }

  delete(variable: string): void {
    this.envVars.delete(variable);
  }

  clear(): void {
    this.envVars.clear();
  }

  *[Symbol.iterator](): Iterator<[string, EnvironmentVariableMutator]> {
    for (const [key, value] of this.envVars.entries()) {
      yield [key, value];
    }
  }

  getScoped(_scope: EnvironmentVariableScope): EnvironmentVariableCollection {
    return this;
  }
}
