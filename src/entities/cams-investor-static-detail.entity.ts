import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';
import type { CompanyArn } from './company-arn.entity';
import type { Investor } from './investor.entity';

@Entity('cams_investor_static_details')
@Unique(['foliochk', 'amc_code'])
export class CamsInvestorStaticDetail {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    company_arn_id: string;

    @ManyToOne('CompanyArn', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_arn_id' })
    company_arn: CompanyArn;

    @Column({ nullable: true })
    investor_id: string;

    @ManyToOne('Investor', 'static_details', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'investor_id' })
    investor: Investor;

    // Folio Information
    @Column({ nullable: true })
    foliochk: string;

    @Column({ nullable: true })
    folio_old: string;

    @Column({ nullable: true })
    scheme_folio_number: string;

    @Column({ type: 'date', nullable: true })
    folio_date: Date;

    // Investor Personal Information
    @Column({ nullable: true })
    inv_name: string;

    @Column({ type: 'date', nullable: true })
    inv_dob: Date;

    @Column({ nullable: true })
    mobile_no: string;

    @Column({ nullable: true })
    phone_off: string;

    @Column({ nullable: true })
    phone_res: string;

    @Column({ nullable: true })
    email: string;

    @Column({ nullable: true })
    occupation: string;

    @Column({ nullable: true })
    holding_nature: string;

    @Column({ nullable: true })
    country: string;

    // Address Information
    @Column({ nullable: true })
    address1: string;

    @Column({ nullable: true })
    address2: string;

    @Column({ nullable: true })
    address3: string;

    @Column({ nullable: true })
    city: string;

    @Column({ nullable: true })
    pincode: string;

    // Joint Holder Information
    @Column({ nullable: true })
    jnt_name1: string;

    @Column({ nullable: true })
    jnt_name2: string;

    @Column({ type: 'date', nullable: true })
    jh1_dob: Date;

    @Column({ type: 'date', nullable: true })
    jh2_dob: Date;

    @Column({ nullable: true })
    jh1_ckyc: string;

    @Column({ nullable: true })
    jh2_ckyc: string;

    // Guardian Information
    @Column({ nullable: true })
    guard_name: string;

    @Column({ type: 'date', nullable: true })
    guardian_dob: Date;

    @Column({ nullable: true })
    guard_pan: string;

    @Column({ nullable: true })
    g_ckyc_no: string;

    // Identification Numbers
    @Column({ nullable: true })
    pan_no: string;

    @Column({ nullable: true })
    joint1_pan: string;

    @Column({ nullable: true })
    joint2_pan: string;

    @Column({ nullable: true })
    aadhaar: string;

    @Column({ nullable: true })
    uin_no: string;

    @Column({ nullable: true, length: 100 })
    inv_iin: string;

    @Column({ nullable: true })
    fh_ckyc_no: string;

    // Tax and Status
    @Column({ nullable: true })
    tax_status: string;

    @Column({ nullable: true })
    gst_state_code: string;

    // Scheme and Product Information
    @Column({ nullable: true })
    product: string;

    @Column({ nullable: true })
    sch_name: string;

    @Column({ nullable: true })
    amc_code: string;

    @Column({ type: 'date', nullable: true })
    rep_date: Date;

    // Balance Information
    @Column({ type: 'decimal', precision: 18, scale: 3, nullable: true })
    clos_bal: number;

    @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
    rupee_bal: number;

    // Broker Information
    @Column({ nullable: true })
    broker_code: string;

    @Column({ nullable: true })
    subbroker: string;

    @Column({ nullable: true })
    brokcode: string;

    @Column({ nullable: true })
    reinv_flag: string;

    // Bank Account Information
    @Column({ nullable: true })
    bank_name: string;

    @Column({ nullable: true })
    branch: string;

    @Column({ nullable: true })
    ac_type: string;

    @Column({ nullable: true })
    ac_no: string;

    @Column({ nullable: true })
    ifsc_code: string;

    @Column({ nullable: true })
    b_address1: string;

    @Column({ nullable: true })
    b_address2: string;

    @Column({ nullable: true })
    b_address3: string;

    @Column({ nullable: true })
    b_city: string;

    @Column({ nullable: true })
    b_pincode: string;

    // Demat Information
    @Column({ nullable: true })
    dp_id: string;

    @Column({ nullable: true })
    demat: string;

    // Nominee 1 Information
    @Column({ nullable: true })
    nom_name: string;

    @Column({ nullable: true })
    relation: string;

    @Column({ nullable: true })
    nom_addr1: string;

    @Column({ nullable: true })
    nom_addr2: string;

    @Column({ nullable: true })
    nom_addr3: string;

    @Column({ nullable: true })
    nom_city: string;

    @Column({ nullable: true })
    nom_state: string;

    @Column({ nullable: true })
    nom_pincode: string;

    @Column({ nullable: true })
    nom_ph_off: string;

    @Column({ nullable: true })
    nom_ph_res: string;

    @Column({ nullable: true })
    nom_email: string;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    nom_percentage: number;

    // Nominee 2 Information
    @Column({ nullable: true })
    nom2_name: string;

    @Column({ nullable: true })
    nom2_relation: string;

    @Column({ nullable: true })
    nom2_addr1: string;

    @Column({ nullable: true })
    nom2_addr2: string;

    @Column({ nullable: true })
    nom2_addr3: string;

    @Column({ nullable: true })
    nom2_city: string;

    @Column({ nullable: true })
    nom2_state: string;

    @Column({ nullable: true })
    nom2_pincode: string;

    @Column({ nullable: true })
    nom2_ph_off: string;

    @Column({ nullable: true })
    nom2_ph_res: string;

    @Column({ nullable: true })
    nom2_email: string;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    nom2_percentage: number;

    // Nominee 3 Information
    @Column({ nullable: true })
    nom3_name: string;

    @Column({ nullable: true })
    nom3_relation: string;

    @Column({ nullable: true })
    nom3_addr1: string;

    @Column({ nullable: true })
    nom3_addr2: string;

    @Column({ nullable: true })
    nom3_addr3: string;

    @Column({ nullable: true })
    nom3_city: string;

    @Column({ nullable: true })
    nom3_state: string;

    @Column({ nullable: true })
    nom3_pincode: string;

    @Column({ nullable: true })
    nom3_ph_off: string;

    @Column({ nullable: true })
    nom3_ph_res: string;

    @Column({ nullable: true })
    nom3_email: string;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    nom3_percentage: number;

    // Additional Fields
    @Column({ nullable: true })
    tpa_linked: string;

    @Column({ type: 'text', nullable: true })
    remarks: string;

    // Metadata
    @Column({ nullable: true })
    request_id: string; // From email subject: Request Id:202417544R9

    @Column({ nullable: true })
    file_name: string; // Original ZIP/Excel file name

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;
}
