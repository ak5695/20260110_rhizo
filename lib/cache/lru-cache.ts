/**
 * LRU (Least Recently Used) Cache Implementation
 * Level 1 Cache: In-memory, fastest access
 */

interface CacheNode<T> {
  key: string;
  value: T;
  timestamp: number;
  prev: CacheNode<T> | null;
  next: CacheNode<T> | null;
}

export class LRUCache<T> {
  private capacity: number;
  private cache: Map<string, CacheNode<T>>;
  private head: CacheNode<T> | null;
  private tail: CacheNode<T> | null;
  private ttl: number; // Time to live in milliseconds

  constructor(capacity: number = 100, ttl: number = 5 * 60 * 1000) {
    this.capacity = capacity;
    this.cache = new Map();
    this.head = null;
    this.tail = null;
    this.ttl = ttl; // Default: 5 minutes
  }

  get(key: string): T | null {
    const node = this.cache.get(key);
    if (!node) return null;

    // Check if expired
    if (Date.now() - node.timestamp > this.ttl) {
      this.remove(key);
      return null;
    }

    // Move to front (most recently used)
    this.moveToFront(node);
    return node.value;
  }

  set(key: string, value: T): void {
    // Update existing node
    if (this.cache.has(key)) {
      const node = this.cache.get(key)!;
      node.value = value;
      node.timestamp = Date.now();
      this.moveToFront(node);
      return;
    }

    // Create new node
    const newNode: CacheNode<T> = {
      key,
      value,
      timestamp: Date.now(),
      prev: null,
      next: null,
    };

    // Add to cache
    this.cache.set(key, newNode);
    this.addToFront(newNode);

    // Evict if over capacity
    if (this.cache.size > this.capacity) {
      this.evictLRU();
    }
  }

  remove(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    this.removeNode(node);
    this.cache.delete(key);
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
  }

  has(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    // Check if expired
    if (Date.now() - node.timestamp > this.ttl) {
      this.remove(key);
      return false;
    }

    return true;
  }

  size(): number {
    return this.cache.size;
  }

  // Invalidate entries matching a pattern
  invalidatePattern(pattern: RegExp): number {
    let count = 0;
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (pattern.test(key)) {
        this.remove(key);
        count++;
      }
    }
    return count;
  }

  private moveToFront(node: CacheNode<T>): void {
    this.removeNode(node);
    this.addToFront(node);
  }

  private addToFront(node: CacheNode<T>): void {
    node.next = this.head;
    node.prev = null;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: CacheNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private evictLRU(): void {
    if (!this.tail) return;

    const key = this.tail.key;
    this.removeNode(this.tail);
    this.cache.delete(key);
  }

  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      capacity: this.capacity,
      utilization: (this.cache.size / this.capacity) * 100,
      ttl: this.ttl,
    };
  }
}
