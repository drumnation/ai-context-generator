import * as vscode from 'vscode';
import { ContainerBase } from './container-base';
import { ServiceMap } from './types';

export class Container implements ContainerBase {
  private services: Map<keyof ServiceMap | string, unknown> = new Map();
  public context!: vscode.ExtensionContext;

  register<K extends keyof ServiceMap>(name: K, service: ServiceMap[K]): void;
  register<T>(name: string, service: T): void;
  register(name: string | keyof ServiceMap, service: unknown): void {
    this.services.set(name, service);
  }

  resolve<K extends keyof ServiceMap>(name: K): ServiceMap[K];
  resolve<T>(name: string): T;
  resolve(name: string | keyof ServiceMap): unknown {
    const service = this.services.get(name);
    if (service === undefined) {
      throw new Error(`Service '${name}' not found in container`);
    }
    return service;
  }

  setContext(context: vscode.ExtensionContext): void {
    this.context = context;
  }
}
