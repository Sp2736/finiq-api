import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';

/**
 * Investor query parameters DTO
 */
export class InvestorQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sort?: string; // e.g., "-created_at,inv_name"

  @IsOptional()
  @IsString()
  search?: string; // Global search across name, email, mobile, pan

  @IsOptional()
  @IsString()
  amc_code?: string; // Filter by AMC

  @IsOptional()
  @IsString()
  pan?: string; // Filter by PAN
}
