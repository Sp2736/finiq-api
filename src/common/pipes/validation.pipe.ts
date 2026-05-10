import { BadRequestException, PipeTransform, Injectable } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

/**
 * Validation pipe for DTOs - Enterprise grade validation
 */
@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: any, metadata: any) {
    if (!metadata.type || typeof value !== 'object') {
      return value;
    }

    const object = plainToInstance(metadata.type, value);
    const errors = await validate(object);

    if (errors.length > 0) {
      const messages = errors.map((error) => ({
        field: error.property,
        errors: Object.values(error.constraints || {}),
      }));

      throw new BadRequestException({
        success: false,
        message: 'Validation failed',
        errors: messages,
        timestamp: new Date().toISOString(),
      });
    }

    return value;
  }
}
