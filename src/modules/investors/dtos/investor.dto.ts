import { IsOptional, IsString, IsDate, IsNumber, IsEmail, ValidateNested } from 'class-validator';

/**
 * Investor Response DTO - Flattened investor details
 */
export class InvestorResponseDto {
  id: string;
  foliochk: string;
  inv_name: string;
  email: string;
  mobile_no: string;
  pan_no: string;
  aadhaar: string;
  address1: string;
  city: string;
  pincode: string;
  country: string;
  company_arn_id: string;
  amc_code: string;
  sch_name: string;
  product: string;
  clos_bal: number;
  rupee_bal: number;
  created_at: Date;
}

/**
 * Investor List Item DTO - Minimal info for list view
 */
export class InvestorListItemDto {
  id: string;
  investor_name: string;
  pan_no: string;
  mobile_no: string;
  guardian_pan: string;
  username: string;
  email: string;
  assigned_broker?: {
    name: string;
    arn: string | null;
  } | null;
}

/**
 * Investor Search DTO - For search results
 */
export class InvestorSearchDto {
  id: string;
  foliochk: string;
  inv_name: string;
  email: string;
  mobile_no: string;
  pan_no: string;
  amc_code: string;
  created_at: Date;
}

/**
 * Investor Details DTO - Complete investor information
 */
export class InvestorFolioDto {
  id: string;

  foliochk: string | null;
  folio_old: string | null;
  scheme_folio_number: string | null;

  inv_name: string | null;
  inv_dob: Date | null;

  email: string | null;
  mobile_no: string | null;
  phone_off: string | null;
  phone_res: string | null;

  occupation: string | null;
  country: string | null;

  pan_no: string | null;
  aadhaar: string | null;
  uin_no: string | null;

  address1: string | null;
  address2: string | null;
  address3: string | null;
  city: string | null;
  pincode: string | null;

  amc_code: string | null;
  sch_name: string | null;
  product: string | null;

  clos_bal: number | null;
  rupee_bal: number | null;

  bank_name: string | null;
  branch: string | null;
  ac_type: string | null;
  ac_no: string | null;
  ifsc_code: string | null;

  jnt_name1: string | null;
  jnt_name2: string | null;

  nom_name: string | null;
  nom2_name: string | null;
  nom3_name: string | null;
  nom_percentage: number | null;

  created_at: Date;
}

export class InvestorDto {
  id: string;
  company_id: string;

  name: string | null;
  pan: string;
  is_guest_pan: boolean;

  date_of_birth: Date | null;
  email: string | null;
  mobile: string | null;

  guardian_name: string | null;
  guardian_pan: string | null;

  created_at: Date;
  updated_at: Date;
}
