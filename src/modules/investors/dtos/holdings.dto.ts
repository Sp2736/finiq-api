import { IsString, IsNumber, IsDecimal, IsOptional, IsDate } from 'class-validator';

/**
 * Holding Item DTO - Individual holding/investment
 */
export class HoldingItemDto {
  @IsString()
  foliochk: string;

  @IsString()
  sch_code: string;

  @IsString()
  sch_name: string;

  @IsString()
  amc_code: string;

  @IsString()
  amc_name: string;

  @IsNumber()
  quantity: number;

  @IsDecimal()
  closing_balance: number;

  @IsDecimal()
  invested_amount: number;

  @IsDecimal()
  current_value: number;

  @IsDecimal()
  gain_loss: number;

  @IsNumber()
  gain_loss_percentage: number;

  @IsNumber()
  @IsOptional()
  nav_rate?: number;

  @IsDecimal()
  rupee_balance: number;

  @IsString()
  @IsOptional()
  product?: string;

  @IsDate()
  @IsOptional()
  last_updated?: Date;

  @IsString()
  @IsOptional()
  investment_type?: string; // 'SIP' | 'LUMPSUM' | 'MIXED'

  @IsString()
  @IsOptional()
  sip_status?: string; // 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'TERMINATED' | 'EXPIRED' | 'N/A'

  @IsNumber()
  @IsOptional()
  one_day_change?: number | null; // percentage change in NAV from yesterday

  @IsNumber()
  @IsOptional()
  xirr?: number | null; // Extended Internal Rate of Return

  @IsNumber()
  @IsOptional()
  abs?: number; // Absolute gain/loss amount (same as gain_loss)
}

/**
 * Portfolio Holdings DTO - Collection of investments
 */
export class PortfolioHoldingsDto {
  @IsString()
  investor_id: string;

  @IsString()
  folio_number: string;

  @IsString()
  investor_name: string;

  @IsNumber()
  total_holdings: number;

  @IsDecimal()
  total_units: number;

  @IsDecimal()
  total_market_value: number;

  @IsDecimal()
  total_invested: number;

  @IsDecimal()
  total_gain_loss: number;

  @IsNumber()
  total_return_percentage: number;

  @IsOptional()
  holdings: HoldingItemDto[];

  @IsDate()
  @IsOptional()
  last_updated?: Date;
}
