import { IsString, IsDate, IsEnum, IsNumber, IsDecimal, IsOptional } from 'class-validator';

/**
 * Folio Status DTO
 */
export class FolioStatusItemDto {
  @IsString()
  foliochk: string;

  @IsString()
  folio_number: string;

  @IsString()
  scheme_code: string;

  @IsString()
  scheme_name: string;

  @IsString()
  amc_code: string;

  @IsString()
  amc_name: string;

  @IsEnum(['Active', 'Inactive', 'Closed', 'Pending', 'Suspended'])
  status: string;

  @IsDecimal()
  current_balance: number;

  @IsDecimal()
  market_value: number;

  @IsDate()
  @IsOptional()
  last_transaction_date?: Date;

  @IsNumber()
  @IsOptional()
  transaction_count?: number;

  @IsString()
  @IsOptional()
  account_type?: string;
}

/**
 * Folio Status Details DTO
 */
export class FolioStatusDetailsDto {
  @IsString()
  investor_id: string;

  @IsString()
  pan_number: string;

  @IsString()
  investor_name: string;

  @IsNumber()
  total_folios: number;

  @IsNumber()
  active_folios: number;

  @IsNumber()
  inactive_folios: number;

  @IsDecimal()
  total_rupee_value: number;

  @IsDecimal()
  total_market_value: number;

  @IsOptional()
  folio_details?: FolioStatusItemDto[];

  @IsDate()
  @IsOptional()
  last_updated?: Date;

  @IsString()
  @IsOptional()
  overall_status?: string;
}
