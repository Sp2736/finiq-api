import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';
import type { CompanyArn } from './company-arn.entity';
import type { Investor } from './investor.entity';

@Entity('cams_investor_transactions')
@Unique(['trxnno', 'amc_code', 'company_arn_id', 'folio_no', 'trxntype'])
export class CamsInvestorTransaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    company_arn_id: string;

    @ManyToOne('CompanyArn', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_arn_id' })
    company_arn: CompanyArn;

    @Column({ nullable: true })
    investor_id: string;

    @ManyToOne('Investor', 'transactions', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'investor_id' })
    investor: Investor;

    // AMC and Scheme Information
    @Column({ nullable: true, length: 10 })
    amc_code: string;

    @Column({ nullable: true, length: 10 })
    prodcode: string;

    @Column({ nullable: true, length: 255 })
    scheme: string;

    @Column({ nullable: true, length: 100 })
    scheme_type: string;

    // Investor and Folio Information
    @Column({ length: 50 })
    folio_no: string;

    @Column({ nullable: true, length: 255 })
    inv_name: string;

    @Column({ nullable: true, length: 10 })
    pan: string;

    @Column({ nullable: true, length: 100 })
    altfolio: string;

    @Column({ nullable: true, length: 50 })
    folio_old: string;

    @Column({ nullable: true, length: 50 })
    scheme_folio_number: string;

    // Transaction Identifiers
    @Column({ length: 100 })
    trxnno: string;

    @Column({ nullable: true, length: 100 })
    seq_no: string;

    @Column({ nullable: true, length: 100 })
    usrtrxno: string;

    @Column({ nullable: true, length: 100 })
    application_no: string;

    @Column({ nullable: true, length: 100 })
    siptrxnno: string;

    @Column({ nullable: true, length: 50 })
    original_trxnno: string;

    @Column({ nullable: true, length: 100 })
    request_ref_no: string;

    @Column({ nullable: true, length: 50 })
    amc_ref_no: string;

    // Transaction Details
    @Column({ length: 100 })
    trxntype: string;

    @Column({ nullable: true, length: 50 })
    trxn_type_flag: string;

    @Column({ nullable: true, length: 10 })
    trxnsubtyp: string;

    @Column({ nullable: true, length: 10 })
    trxnmode: string;

    @Column({ nullable: true, length: 10 })
    trxnstat: string;

    @Column({ nullable: true, length: 255 })
    trxn_nature: string;

    @Column({ nullable: true, length: 255 })
    trxn_suffix: string;

    @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
    trxn_charges: number;

    // Dates
    @Column({ type: 'date', nullable: true })
    traddate: Date;

    @Column({ type: 'date', nullable: true })
    postdate: Date;

    @Column({ type: 'date', nullable: true })
    rep_date: Date;

    @Column({ type: 'date', nullable: true })
    sys_regn_date: Date;

    @Column({ type: 'date', nullable: true })
    ticob_posted_date: Date;

    @Column({ type: 'date', nullable: true })
    ca_initiated_date: Date;

    // Transaction Amounts and Units
    @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
    purprice: number;

    @Column({ type: 'numeric', precision: 18, scale: 6, nullable: true })
    units: number;

    @Column({ type: 'numeric', precision: 18, scale: 2 })
    amount: number;

    @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
    eligib_amt: number;

    // Broker Information
    @Column({ nullable: true, length: 50 })
    brokcode: string;

    @Column({ nullable: true, length: 50 })
    subbrok: string;

    @Column({ nullable: true, length: 50 })
    sub_brk_arn: string;

    @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
    brokperc: number;

    @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
    brokcomm: number;

    @Column({ nullable: true, length: 50 })
    mult_brok: string;

    @Column({ nullable: true, length: 50 })
    src_brk_code: string;

    // User and Location
    @Column({ nullable: true, length: 50 })
    usercode: string;

    @Column({ nullable: true, length: 50 })
    location: string;

    @Column({ nullable: true, length: 10 })
    ter_location: string;

    // Tax Information
    @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
    tax: number;

    @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
    total_tax: number;

    @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
    stt: number;

    @Column({ nullable: true, length: 10 })
    te_15h: string;

    // GST Information
    @Column({ nullable: true, length: 10 })
    gst_state_code: string;

    @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
    igst_amount: number;

    @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
    cgst_amount: number;

    @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
    sgst_amount: number;

    @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
    stamp_duty: number;

    // Load and Charges
    @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
    load: number;

    // Flags and Status
    @Column({ nullable: true, length: 10 })
    swflag: string;

    @Column({ nullable: true, length: 10 })
    reinvest_flag: string;

    @Column({ nullable: true, length: 10 })
    exch_dc_flag: string;

    @Column({ nullable: true, length: 10 })
    exchange_flag: string;

    @Column({ nullable: true, length: 10 })
    transmission_flag: string;

    // EUIN Information
    @Column({ nullable: true, length: 100 })
    euin: string;

    @Column({ nullable: true, length: 10 })
    euin_valid: string;

    @Column({ nullable: true, length: 10 })
    euin_opted: string;

    // Additional Fields
    @Column({ nullable: true, length: 100 })
    inv_iin: string;

    @Column({ nullable: true, length: 100 })
    targ_src_scheme: string;

    @Column({ nullable: true, length: 100 })
    ticob_trtype: string;

    @Column({ nullable: true, length: 50 })
    ticob_trno: string;

    @Column({ nullable: true, length: 50 })
    dp_id: string;

    @Column({ nullable: true, length: 50 })
    src_of_txn: string;

    @Column({ nullable: true, length: 50 })
    reversal_code: string;

    // Bank and Account Information
    @Column({ nullable: true, length: 50 })
    ac_no: string;

    @Column({ nullable: true, length: 100 })
    bank_name: string;

    @Column({ nullable: true, length: 100 })
    micr_no: string;

    // Reference Numbers
    @Column({ nullable: true, length: 100 })
    scanrefno: string;

    // Time and Remarks
    @Column({ nullable: true, length: 100 })
    time1: string;

    @Column({ type: 'text', nullable: true })
    remarks: string;

    @Column({ type: 'text', nullable: true })
    rev_remark: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}
