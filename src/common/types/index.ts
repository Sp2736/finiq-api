/**
 * Common types and interfaces used across the application
 */

export interface PaginationParams {
  page?: number;
  limit?: number;
  skip?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
  path?: string;
}

export interface FilterOptions {
  [key: string]: any;
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export interface SortOptions {
  field: string;
  order: SortOrder;
}
