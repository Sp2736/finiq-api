/**
 * Pagination helper utility
 */

import { PaginationParams } from '../types';

export class PaginationHelper {
  static getPaginationParams(page?: number, limit?: number): PaginationParams {
    const pageNum = Math.max(1, page || 1);
    const limitNum = Math.min(Math.max(1, limit || 10), 100); // Max 100 items per page
    const skip = (pageNum - 1) * limitNum;

    return {
      page: pageNum,
      limit: limitNum,
      skip,
    };
  }

  static validatePaginationParams(page: any, limit: any) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;

    if (pageNum < 1) throw new Error('Page must be greater than 0');
    if (limitNum < 1 || limitNum > 100) throw new Error('Limit must be between 1 and 100');

    return { page: pageNum, limit: limitNum };
  }
}
