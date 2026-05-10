/**
 * HTTP status codes and error codes mapping
 */

export enum ApiErrorCode {
  // Success codes
  SUCCESS = 'SUCCESS',
  CREATED = 'CREATED',

  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // Business logic errors
  INVALID_STATE = 'INVALID_STATE',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',

  OTP_INVALID = 'OTP_INVALID',
  OTP_EXPIRED = 'OTP_EXPIRED',
  OTP_ALREADY_USED = 'OTP_ALREADY_USED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  SUB_BROKER_NOT_FOUND = 'SUB_BROKER_NOT_FOUND',
  QUERY_PARAMS_REQUIRED = 'QUERY_PARAMS_REQUIRED',
  COMPANY_ID_NOT_FOUND = 'COMPANY_ID_NOT_FOUND'
}

export const ErrorMessages: Record<ApiErrorCode, string> = {
  [ApiErrorCode.SUCCESS]: 'Request successful',
  [ApiErrorCode.CREATED]: 'Resource created successfully',
  [ApiErrorCode.BAD_REQUEST]: 'Bad request',
  [ApiErrorCode.VALIDATION_ERROR]: 'Validation error',
  [ApiErrorCode.UNAUTHORIZED]: 'Unauthorized',
  [ApiErrorCode.FORBIDDEN]: 'Forbidden',
  [ApiErrorCode.NOT_FOUND]: 'Resource not found',
  [ApiErrorCode.CONFLICT]: 'Conflict',
  [ApiErrorCode.RATE_LIMITED]: 'Rate limited',
  [ApiErrorCode.INTERNAL_ERROR]: 'Internal server error',
  [ApiErrorCode.SERVICE_UNAVAILABLE]: 'Service unavailable',
  [ApiErrorCode.DATABASE_ERROR]: 'Database error',
  [ApiErrorCode.INVALID_STATE]: 'Invalid state',
  [ApiErrorCode.OPERATION_NOT_ALLOWED]: 'Operation not allowed',
  [ApiErrorCode.RESOURCE_EXHAUSTED]: 'Resource exhausted',
  [ApiErrorCode.OTP_INVALID]: 'Invalid OTP provided',
  [ApiErrorCode.OTP_EXPIRED]: 'OTP has expired',
  [ApiErrorCode.OTP_ALREADY_USED]: 'OTP has already been used',
  [ApiErrorCode.USER_NOT_FOUND]: 'User not found',
  [ApiErrorCode.SUB_BROKER_NOT_FOUND]: 'Sub-broker not found',
  [ApiErrorCode.QUERY_PARAMS_REQUIRED]: 'Required query parameters are missing',
  [ApiErrorCode.COMPANY_ID_NOT_FOUND]: 'Company ID could not be identified',
};
