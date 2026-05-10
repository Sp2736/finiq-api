import { Injectable, Logger } from '@nestjs/common';
import { PaginationParams, PaginatedResponse } from '../types';

/**
 * Generic base service for reusable business logic
 * Handles pagination, filtering, and common operations
 */
@Injectable()
export class BaseService<Entity, CreateDto, UpdateDto> {
  protected logger: Logger;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  protected formatPaginatedResponse<T>(
    data: T[],
    total: number,
    pagination: PaginationParams,
  ): PaginatedResponse<T> {
    const limit = pagination.limit || 10;
    const page = pagination.page || 1;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  protected async handleError(error: any, context: string) {
    this.logger.error(`Error in ${context}: ${error.message}`, error.stack);
    throw error;
  }
}
