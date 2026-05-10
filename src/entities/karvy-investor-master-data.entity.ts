import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Investor } from './investor.entity';
import { CompanyArn } from './company-arn.entity';

@Entity('karvy_investor_master_data')
export class KarvyInvestorMasterData {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', nullable: true })
    investor_id: string;

    @ManyToOne(() => Investor, { nullable: true })
    @JoinColumn({ name: 'investor_id' })
    investor: Investor;

    @Column({ type: 'uuid', nullable: true })
    company_arn_id: string;

    @ManyToOne(() => CompanyArn, { nullable: true })
    @JoinColumn({ name: 'company_arn_id' })
    company_arn: CompanyArn;

    @Column({ name: 'product_code', length: 50, nullable: true })
    product_code: string;

    @Column({ name: 'fund', length: 50, nullable: true })
    fund: string;

    @Column({ name: 'folio', length: 100, nullable: true })
    folio: string;

    @Column({ name: 'fund_description', length: 255, nullable: true })
    fund_description: string;

    @Column({ name: 'investor_name', length: 100, nullable: true })
    investor_name: string;

    @Column({ name: 'joint_name_1', length: 100, nullable: true })
    joint_name_1: string;

    @Column({ name: 'joint_name_2', length: 100, nullable: true })
    joint_name_2: string;

    @Column({ name: 'address_1', length: 255, nullable: true })
    address_1: string;

    @Column({ name: 'address_2', length: 255, nullable: true })
    address_2: string;

    @Column({ name: 'address_3', length: 100, nullable: true })
    address_3: string;

    @Column({ name: 'city', length: 100, nullable: true })
    city: string;

    @Column({ name: 'pincode', length: 50, nullable: true })
    pincode: string;

    @Column({ name: 'state', length: 100, nullable: true })
    state: string;

    @Column({ name: 'country', length: 50, nullable: true })
    country: string;

    @Column({ name: 'tpin', length: 50, nullable: true })
    tpin: string;

    @Column({ name: 'date_of_birth', length: 50, nullable: true })
    date_of_birth: string;

    @Column({ name: 'f_name', length: 50, nullable: true })
    f_name: string;

    @Column({ name: 'm_name', length: 50, nullable: true })
    m_name: string;

    @Column({ name: 'phone_residence', length: 100, nullable: true })
    phone_residence: string;

    @Column({ name: 'phone_res_1', length: 50, nullable: true })
    phone_res_1: string;

    @Column({ name: 'phone_res_2', length: 50, nullable: true })
    phone_res_2: string;

    @Column({ name: 'phone_office', length: 100, nullable: true })
    phone_office: string;

    @Column({ name: 'phone_off_1', length: 50, nullable: true })
    phone_off_1: string;

    @Column({ name: 'phone_off_2', length: 50, nullable: true })
    phone_off_2: string;

    @Column({ name: 'fax_residence', length: 50, nullable: true })
    fax_residence: string;

    @Column({ name: 'fax_office', length: 50, nullable: true })
    fax_office: string;

    @Column({ name: 'tax_status', length: 50, nullable: true })
    tax_status: string;

    @Column({ name: 'occ_code', length: 50, nullable: true })
    occ_code: string;

    @Column({ name: 'email', length: 100, nullable: true })
    email: string;

    @Column({ name: 'bank_accno', length: 100, nullable: true })
    bank_accno: string;

    @Column({ name: 'bank_name', length: 100, nullable: true })
    bank_name: string;

    @Column({ name: 'account_type', length: 50, nullable: true })
    account_type: string;

    @Column({ name: 'branch', length: 50, nullable: true })
    branch: string;

    @Column({ name: 'bank_address_1', length: 100, nullable: true })
    bank_address_1: string;

    @Column({ name: 'bank_address_2', length: 100, nullable: true })
    bank_address_2: string;

    @Column({ name: 'bank_address_3', length: 100, nullable: true })
    bank_address_3: string;

    @Column({ name: 'bank_city', length: 100, nullable: true })
    bank_city: string;

    @Column({ name: 'bank_phone', length: 50, nullable: true })
    bank_phone: string;

    @Column({ name: 'bank_state', length: 50, nullable: true })
    bank_state: string;

    @Column({ name: 'bank_country', length: 50, nullable: true })
    bank_country: string;

    @Column({ name: 'karvy_investor_id', length: 50, nullable: true })
    karvy_investor_id: string;

    @Column({ name: 'broker_code', length: 50, nullable: true })
    broker_code: string;

    @Column({ name: 'report_date', length: 50, nullable: true })
    report_date: string;

    @Column({ name: 'report_time', length: 50, nullable: true })
    report_time: string;

    @Column({ name: 'pan_number', length: 50, nullable: true })
    pan_number: string;

    @Column({ name: 'mobile_number', length: 100, nullable: true })
    mobile_number: string;

    @Column({ name: 'dividend_option', length: 50, nullable: true })
    dividend_option: string;

    @Column({ name: 'occupation_description', length: 100, nullable: true })
    occupation_description: string;

    @Column({ name: 'mode_of_holding_description', length: 100, nullable: true })
    mode_of_holding_description: string;

    @Column({ name: 'mapin_id', length: 50, nullable: true })
    mapin_id: string;

    @Column({ name: 'pan2', length: 50, nullable: true })
    pan2: string;

    @Column({ name: 'pan3', length: 50, nullable: true })
    pan3: string;

    @Column({ name: 'category', length: 50, nullable: true })
    category: string;

    @Column({ name: 'guardian_name', length: 100, nullable: true })
    guardian_name: string;

    @Column({ name: 'nominee', length: 100, nullable: true })
    nominee: string;

    @Column({ name: 'client_id', length: 50, nullable: true })
    client_id: string;

    @Column({ name: 'dpid', length: 50, nullable: true })
    dpid: string;

    @Column({ name: 'category_desc', length: 100, nullable: true })
    category_desc: string;

    @Column({ name: 'status_desc', length: 100, nullable: true })
    status_desc: string;

    @Column({ name: 'ifsc_code', length: 100, nullable: true })
    ifsc_code: string;

    @Column({ name: 'nominee2', length: 100, nullable: true })
    nominee2: string;

    @Column({ name: 'nominee3', length: 100, nullable: true })
    nominee3: string;

    @Column({ name: 'kyc1flag', length: 50, nullable: true })
    kyc1flag: string;

    @Column({ name: 'kyc2flag', length: 50, nullable: true })
    kyc2flag: string;

    @Column({ name: 'kyc3flag', length: 50, nullable: true })
    kyc3flag: string;

    @Column({ name: 'guard_pan_no', length: 50, nullable: true })
    guard_pan_no: string;

    @Column({ name: 'last_updated_date', length: 50, nullable: true })
    last_updated_date: string;

    @Column({ name: 'common_acc_no', length: 50, nullable: true })
    common_acc_no: string;

    @Column({ name: 'nominee_relation', length: 100, nullable: true })
    nominee_relation: string;

    @Column({ name: 'nominee2_relation', length: 50, nullable: true })
    nominee2_relation: string;

    @Column({ name: 'nominee3_relation', length: 50, nullable: true })
    nominee3_relation: string;

    @Column({ name: 'nominee_ratio', length: 50, nullable: true })
    nominee_ratio: string;

    @Column({ name: 'nominee2_ratio', length: 50, nullable: true })
    nominee2_ratio: string;

    @Column({ name: 'nominee3_ratio', length: 50, nullable: true })
    nominee3_ratio: string;

    @Column({ name: 'holder_1_aadhaar_info', length: 50, nullable: true })
    holder_1_aadhaar_info: string;

    @Column({ name: 'holder_2_aadhaar_info', length: 50, nullable: true })
    holder_2_aadhaar_info: string;

    @Column({ name: 'holder_3_aadhaar_info', length: 50, nullable: true })
    holder_3_aadhaar_info: string;

    @Column({ name: 'guardian_aadhaar_info', length: 50, nullable: true })
    guardian_aadhaar_info: string;

    @Column({ name: 'nominee_address1', length: 100, nullable: true })
    nominee_address1: string;

    @Column({ name: 'nominee_address2', length: 100, nullable: true })
    nominee_address2: string;

    @Column({ name: 'nominee_address3', length: 100, nullable: true })
    nominee_address3: string;

    @Column({ name: 'nominee_city', length: 100, nullable: true })
    nominee_city: string;

    @Column({ name: 'nominee_state', length: 100, nullable: true })
    nominee_state: string;

    @Column({ name: 'nominee_pin_code', length: 50, nullable: true })
    nominee_pin_code: string;

    @Column({ name: 'nominee_phone_residence', length: 50, nullable: true })
    nominee_phone_residence: string;

    @Column({ name: 'nominee_email', length: 100, nullable: true })
    nominee_email: string;

    @Column({ name: 'nominee2_address1', length: 100, nullable: true })
    nominee2_address1: string;

    @Column({ name: 'nominee2_address2', length: 100, nullable: true })
    nominee2_address2: string;

    @Column({ name: 'nominee2_address3', length: 100, nullable: true })
    nominee2_address3: string;

    @Column({ name: 'nominee2_city', length: 50, nullable: true })
    nominee2_city: string;

    @Column({ name: 'nominee2_state', length: 50, nullable: true })
    nominee2_state: string;

    @Column({ name: 'nominee2_pin_code', length: 50, nullable: true })
    nominee2_pin_code: string;

    @Column({ name: 'nominee2_phone_residence', length: 50, nullable: true })
    nominee2_phone_residence: string;

    @Column({ name: 'nominee2_email', length: 100, nullable: true })
    nominee2_email: string;

    @Column({ name: 'nominee3_address1', length: 100, nullable: true })
    nominee3_address1: string;

    @Column({ name: 'nominee3_address2', length: 50, nullable: true })
    nominee3_address2: string;

    @Column({ name: 'nominee3_address3', length: 50, nullable: true })
    nominee3_address3: string;

    @Column({ name: 'nominee3_city', length: 50, nullable: true })
    nominee3_city: string;

    @Column({ name: 'nominee3_state', length: 50, nullable: true })
    nominee3_state: string;

    @Column({ name: 'nominee3_pin_code', length: 50, nullable: true })
    nominee3_pin_code: string;

    @Column({ name: 'nominee3_phone_residence', length: 50, nullable: true })
    nominee3_phone_residence: string;

    @Column({ name: 'nominee3_email', length: 100, nullable: true })
    nominee3_email: string;

    @Column({ name: 'ckyc_no', length: 100, nullable: true })
    ckyc_no: string;

    @Column({ name: 'jh1_ckyc', length: 100, nullable: true })
    jh1_ckyc: string;

    @Column({ name: 'jh2_ckyc', length: 100, nullable: true })
    jh2_ckyc: string;

    @Column({ name: 'guardian_ckyc_no', length: 100, nullable: true })
    guardian_ckyc_no: string;

    @Column({ name: 'joint_holder_1st_resi_phone_no', length: 50, nullable: true })
    joint_holder_1st_resi_phone_no: string;

    @Column({ name: 'joint_holder_2nd_resi_phone_no', length: 50, nullable: true })
    joint_holder_2nd_resi_phone_no: string;

    @Column({ name: 'investors_resi_fax_no', length: 50, nullable: true })
    investors_resi_fax_no: string;

    @Column({ name: 'kyc_gflag', length: 50, nullable: true })
    kyc_gflag: string;

    @Column({ name: 'demat_folio_flag', length: 50, nullable: true })
    demat_folio_flag: string;

    @Column({ name: 'nominee_opt_out_flag', length: 50, nullable: true })
    nominee_opt_out_flag: string;

    @Column({ name: 'nominee_dob', length: 50, nullable: true })
    nominee_dob: string;

    @Column({ name: 'joint_holder_1_contact_number', length: 100, nullable: true })
    joint_holder_1_contact_number: string;

    @Column({ name: 'joint_holder_1_email_id', length: 100, nullable: true })
    joint_holder_1_email_id: string;

    @Column({ name: 'joint_holder_2_contact_number', length: 100, nullable: true })
    joint_holder_2_contact_number: string;

    @Column({ name: 'joint_holder_2_email_id', length: 100, nullable: true })
    joint_holder_2_email_id: string;

    @Column({ name: 'nominee_guardian_name', length: 100, nullable: true })
    nominee_guardian_name: string;

    @Column({ name: 'emailconcern', length: 100, nullable: true })
    emailconcern: string;

    @Column({ name: 'emailrelationship', length: 50, nullable: true })
    emailrelationship: string;

    @Column({ name: 'mobile_relationship', length: 100, nullable: true })
    mobile_relationship: string;

    @Column({ name: 'ubo_flag', length: 50, nullable: true })
    ubo_flag: string;

    @Column({ name: 'npo_flag', length: 50, nullable: true })
    npo_flag: string;
}
