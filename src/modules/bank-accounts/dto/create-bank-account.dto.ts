import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CreateBankAccountDto {
  @IsString()
  @IsNotEmpty()
  company_id: string;

  @IsString()
  @IsOptional()
  arn_id?: string;

  @IsString()
  @IsOptional()
  sub_broker_id?: string;

  @IsString()
  @IsNotEmpty()
  bank_name: string;

  @IsString()
  @IsNotEmpty()
  account_number: string;

  @IsString()
  @IsNotEmpty()
  account_holder_name: string;

  @IsString()
  @IsNotEmpty()
  ifsc_code: string;

  @IsString()
  @IsOptional()
  upi_id?: string;

  @IsBoolean()
  @IsOptional()
  is_primary?: boolean;
}
