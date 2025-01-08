import { CacheService } from '../cacheService';
import { logger } from '../../../shared/logger';

jest.mock('../../../shared/logger');

describe('CacheService', () => {
  let cacheService: CacheService<string>;
  let mockLogger: jest.Mocked<typeof logger>;
  let now: number;

  beforeEach(() => {
    mockLogger = logger as jest.Mocked<typeof logger>;
    cacheService = new CacheService(100, 3); // 100 bytes max, 3 entries max
    now = Date.now();
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve items', () => {
      cacheService.set('key1', 'value1', 10);
      expect(cacheService.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent items', () => {
      expect(cacheService.get('nonexistent')).toBeUndefined();
    });

    it('should check if item exists', () => {
      cacheService.set('key1', 'value1', 10);
      expect(cacheService.has('key1')).toBe(true);
      expect(cacheService.has('nonexistent')).toBe(false);
    });

    it('should delete items', () => {
      cacheService.set('key1', 'value1', 10);
      cacheService.delete('key1');
      expect(cacheService.has('key1')).toBe(false);
    });

    it('should clear all items', () => {
      cacheService.set('key1', 'value1', 10);
      cacheService.set('key2', 'value2', 10);
      cacheService.clear();
      expect(cacheService.has('key1')).toBe(false);
      expect(cacheService.has('key2')).toBe(false);
    });
  });

  describe('Size Management', () => {
    it('should not cache items larger than max size', () => {
      cacheService.set('large', 'value', 150); // Larger than max size (100)
      expect(cacheService.has('large')).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Item too large for cache',
        expect.any(Object),
      );
    });

    it('should evict items to make space', () => {
      cacheService.set('key1', 'value1', 40);
      cacheService.set('key2', 'value2', 40);
      cacheService.set('key3', 'value3', 40); // Should evict key1
      expect(cacheService.has('key1')).toBe(false);
      expect(cacheService.has('key2')).toBe(true);
      expect(cacheService.has('key3')).toBe(true);
    });

    it('should respect max entries limit', () => {
      cacheService.set('key1', 'value1', 10);
      cacheService.set('key2', 'value2', 10);
      cacheService.set('key3', 'value3', 10);
      cacheService.set('key4', 'value4', 10); // Should evict oldest
      expect(cacheService.getStats().entries).toBe(3);
    });
  });

  describe('LRU Behavior', () => {
    it('should update last accessed time on get', () => {
      cacheService.set('key1', 'value1', 40);
      cacheService.set('key2', 'value2', 40);

      // Access key1 to make it more recent
      jest.advanceTimersByTime(1000);
      cacheService.get('key1');

      // Add new item that requires eviction
      cacheService.set('key3', 'value3', 40);

      // key2 should be evicted as it's least recently used
      expect(cacheService.has('key1')).toBe(true);
      expect(cacheService.has('key2')).toBe(false);
      expect(cacheService.has('key3')).toBe(true);
    });

    it('should evict least recently used items when full', () => {
      cacheService.set('key1', 'value1', 40);
      jest.advanceTimersByTime(1000);
      cacheService.set('key2', 'value2', 40);
      jest.advanceTimersByTime(1000);
      cacheService.set('key3', 'value3', 40); // Should evict key1

      expect(cacheService.has('key1')).toBe(false);
      expect(cacheService.has('key2')).toBe(true);
      expect(cacheService.has('key3')).toBe(true);
    });
  });

  describe('Stats and Monitoring', () => {
    it('should track current size correctly', () => {
      cacheService.set('key1', 'value1', 30);
      cacheService.set('key2', 'value2', 20);
      const stats = cacheService.getStats();
      expect(stats.currentSize).toBe(50);
    });

    it('should update size after deletions', () => {
      cacheService.set('key1', 'value1', 30);
      cacheService.set('key2', 'value2', 20);
      cacheService.delete('key1');
      const stats = cacheService.getStats();
      expect(stats.currentSize).toBe(20);
    });

    it('should report correct stats', () => {
      cacheService.set('key1', 'value1', 10);
      const stats = cacheService.getStats();
      expect(stats).toEqual({
        currentSize: 10,
        maxSize: 100,
        entries: 1,
        maxEntries: 3,
      });
    });
  });
});
