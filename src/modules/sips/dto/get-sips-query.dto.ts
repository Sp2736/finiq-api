import { IsEnum, IsOptional, IsString } from 'class-validator';

// Enum defining the allowed grouping categories for the frontend dropdown
export enum SipGroupBy {
  CLIENT = 'Client',
  AMC = 'AMC',
  SCHEME = 'Scheme',
  REGISTRAR = 'Registrar',
}

// Enum defining the allowed registrar filters
export enum RegistrarFilter {
  CAMS = 'CAMS',
  KARVY = 'KARVY',
  ALL = 'ALL',
}

export class GetSipsQueryDto {
  /**
   * Registrar filter to isolate CAMS, KARVY, or ALL records.
   * Defaults to ALL if not provided by the frontend.
   */
  @IsOptional()
  @IsEnum(RegistrarFilter)
  registrar?: RegistrarFilter = RegistrarFilter.ALL;

  /**
   * The field by which the SIP counts should be aggregated.
   * Defaults to CLIENT if not provided.
   */
  @IsOptional()
  @IsEnum(SipGroupBy)
  groupBy?: SipGroupBy = SipGroupBy.CLIENT;

  /**
   * Removed the required arn validation.
   * ARN is now entirely optional and ignored in this specific grouping logic
   * as per the requirement to default to all ARNs.
   */
  @IsOptional()
  @IsString()
  arn?: string;
}