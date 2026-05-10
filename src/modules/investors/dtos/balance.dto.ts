import { IsString, IsDecimal, IsNumber, IsDate, IsOptional, IsEnum } from 'class-validator';

/**
 * Account Balance Summary DTO
 */
export class AccountBalanceDto {
  @IsString()
  investor_id: string;

  @IsString()
  folio_number: string;

  @IsString()
  investor_name: string;

  @IsDecimal()
  units_balance: number;

  @IsDecimal()
  rupee_balance: number;

  @IsDecimal()
  market_value: number;

  @IsDecimal()
  invested_amount: number;

  @IsDecimal()
  gain_loss: number;

  @IsNumber()
  return_percentage: number;

  @IsNumber()
  @IsOptional()
  nav_rate?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsDate()
  @IsOptional()
  as_on_date?: Date;

  @IsDate()
  @IsOptional()
  last_transaction_date?: Date;
}

/**
 * Balance Summary Response DTO
 */
export class BalanceSummaryDto {
  @IsString()
  investor_id: string;

  @IsString()
  pan_number: string;

  @IsString()
  investor_name: string;

  @IsNumber()
  total_folio_count: number;

  @IsDecimal()
  aggregate_units: number;

  @IsDecimal()
  aggregate_rupee_value: number;

  @IsDecimal()
  aggregate_market_value: number;

  @IsDecimal()
  aggregate_invested: number;

  @IsDecimal()
  aggregate_gain_loss: number;

  @IsNumber()
  aggregate_return_percentage: number;

  @IsOptional()
  folio_balances?: AccountBalanceDto[];

  @IsDate()
  @IsOptional()
  snapshot_date?: Date;
}
