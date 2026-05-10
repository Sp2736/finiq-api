import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom application exceptions for consistent error handling
 */

export class ValidationException extends HttpException {
  constructor(message: string, errors?: any) {
    super(
      {
        success: false,
        message: 'Validation Error',
        error: message,
        details: errors,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class NotFoundException extends HttpException {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with ${identifier} not found`
      : `${resource} not found`;
    super(
      {
        success: false,
        message,
        error: message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message: string = 'Unauthorized') {
    super(
      {
        success: false,
        message,
        error: message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class ForbiddenException extends HttpException {
  constructor(message: string = 'Forbidden') {
    super(
      {
        success: false,
        message,
        error: message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class ConflictException extends HttpException {
  constructor(message: string) {
    super(
      {
        success: false,
        message,
        error: message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class InternalServerException extends HttpException {
  constructor(message: string = 'Internal Server Error') {
    super(
      {
        success: false,
        message,
        error: message,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
