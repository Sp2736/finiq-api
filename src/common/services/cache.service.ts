import { Injectable } from '@nestjs/common';

/**
 * Cache utility for in-memory caching
 * In production, replace with Redis
 */
@Injectable()
export class CacheService {
  private cache = new Map<string, { data: any; expiry: number }>();

  set(key: string, value: any, ttl: number = 3600000): void {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { data: value, expiry });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Generate cache key from parameters
   */
  static generateKey(prefix: string, params: any): string {
    const paramString = JSON.stringify(params);
    return `${prefix}:${Buffer.from(paramString).toString('base64')}`;
  }
}
