import { IsOptional, IsNumber, Min, Max, IsString, ValidateNested } from 'class-validator';

/**
 * Base query DTO for pagination and filtering
 */
export class PaginationQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

/**
 * Extended query DTO with sorting and filtering
 */
export class AdvancedQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  sort?: string; // e.g., "-created_at,name"

  @IsOptional()
  @IsString()
  filter?: string; // e.g., '{"name":{"operator":"like","value":"%john%"}}'

  @IsOptional()
  @IsString()
  search?: string; // Global search across indexed fields
}
