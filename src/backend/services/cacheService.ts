import { logger } from '../../shared/logger';

interface CacheEntry<T> {
  value: T;
  lastAccessed: number;
  size: number;
}

export class CacheService<T> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private currentSize: number;
  private readonly maxEntries: number;

  constructor(
    maxSizeInBytes: number = 100 * 1024 * 1024,
    maxEntries: number = 1000,
  ) {
    this.cache = new Map();
    this.maxSize = maxSizeInBytes;
    this.maxEntries = maxEntries;
    this.currentSize = 0;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
      return entry.value;
    }
    return undefined;
  }

  set(key: string, value: T, size: number): void {
    // If the item is too large for the cache, don't cache it
    if (size > this.maxSize) {
      logger.info('Item too large for cache', {
        key,
        size,
        maxSize: this.maxSize,
      });
      return;
    }

    // Make space if needed
    while (
      (this.currentSize + size > this.maxSize ||
        this.cache.size >= this.maxEntries) &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }

    // If we still can't make enough space, don't cache
    if (this.currentSize + size > this.maxSize) {
      logger.info('Cannot make space in cache', {
        key,
        size,
        currentSize: this.currentSize,
        maxSize: this.maxSize,
      });
      return;
    }

    const entry: CacheEntry<T> = {
      value,
      lastAccessed: Date.now(),
      size,
    };

    this.cache.set(key, entry);
    this.currentSize += size;

    logger.info('Added item to cache', {
      key,
      size,
      currentSize: this.currentSize,
      entries: this.cache.size,
    });
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      this.cache.delete(key);
      logger.info('Removed item from cache', {
        key,
        size: entry.size,
        currentSize: this.currentSize,
      });
    }
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
    logger.info('Cache cleared');
  }

  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      logger.info('Evicted LRU item from cache', { key: oldestKey });
    }
  }

  // For testing and monitoring
  getStats() {
    return {
      currentSize: this.currentSize,
      maxSize: this.maxSize,
      entries: this.cache.size,
      maxEntries: this.maxEntries,
    };
  }
}
