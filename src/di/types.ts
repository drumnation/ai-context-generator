import * as vscode from 'vscode';
import { ContainerBase } from './container-base';

export interface FileService {
  generateFileTree(
    directoryPath: string,
    rootPath: string,
    includeDotFolders: boolean,
  ): Promise<string>;

  combineFiles(
    rootPath: string,
    directoryPath: string,
    includeDotFolders: boolean,
  ): Promise<string>;

  isLargeDirectory(dirPath: string): boolean;
}

export interface PerformanceService {
  startOperation(operation: string): void;
  endOperation(operation: string): void;
  profileDirectoryScanning(directoryPath: string): Promise<void>;
  getMetrics(): Map<string, OperationMetrics>;
  clearMetrics(): void;
}

interface OperationMetrics {
  startTime: number;
  endTime?: number;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter?: NodeJS.MemoryUsage;
  operation: string;
}

export interface WebviewPanelProvider {
  getOrCreateWebviewPanel(
    context: vscode.ExtensionContext,
    container: ContainerBase,
  ): vscode.WebviewPanel;
}

export interface ServiceMap {
  fileService: FileService;
  performanceService: PerformanceService;
  webviewPanelService: WebviewPanelProvider;
}
