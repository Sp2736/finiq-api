import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsUUID,
} from 'class-validator';

export enum CreateUserRole {
  SUB_BROKER = 'SUB_BROKER',
  INVESTOR = 'INVESTOR',
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(CreateUserRole)
  @IsNotEmpty()
  role: CreateUserRole;

  @IsString()
  @IsOptional()
  company_id?: string;

  @IsString()
  @IsOptional()
  parent_id?: string;

  @IsString()
  @IsOptional()
  arn?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  share_percentage?: number;

  @IsString()
  @IsNotEmpty() // we are now using it as the primary key for creating the login User
  phone_number: string;

  @IsString()
  @IsOptional()
  email?: string;
}

export class UpdateSubBrokerDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  arn?: string;

  @IsString()
  @IsOptional()
  parent_id?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  share_percentage?: number;

  @IsString()
  @IsOptional()
  phone_number?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class UpdateCommissionDto {
  @IsUUID()
  @IsNotEmpty()
  broker_id: string;

  @IsUUID()
  @IsNotEmpty()
  sub_broker_id: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  share_percentage: number;
}
