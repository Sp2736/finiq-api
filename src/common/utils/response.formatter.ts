import { ApiResponse } from '../types';

export class ResponseFormatter {
  static success<T>(data: T, message: string = 'Success'): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  static error(message: string, error?: string): ApiResponse<null> {
    return {
      success: false,
      message,
      error: error || message,
      timestamp: new Date().toISOString(),
    };
  }

  static paginated<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ) {
    const totalPages = Math.ceil(total / limit);
    return {
      success: true,
      message: 'Success',
      data: {
        data,
        total,
        page,
        limit,
        totalPages,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
