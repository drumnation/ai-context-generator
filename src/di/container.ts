export class Container {
  private services: Map<string, unknown> = new Map();

  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  resolve<T>(name: string): T {
    const service = this.services.get(name);
    if (service === undefined) {
      throw new Error(`Service '${name}' not found in container`);
    }
    return service as T;
  }
}
