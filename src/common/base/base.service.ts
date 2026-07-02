import { Injectable, Logger, HttpException, InternalServerErrorException } from '@nestjs/common';
import { PaginationParams, PaginatedResponse } from '../types';
import { logAndSanitize } from '../utils/safe-error';

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
    if (error instanceof HttpException) {
      throw error;
    }
    throw new InternalServerErrorException(
      logAndSanitize(this.logger, `Error in ${context}`, error, 'An unexpected error occurred. Please try again.')
    );
  }
}
