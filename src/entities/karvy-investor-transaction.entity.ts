import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    ManyToOne,
    JoinColumn
} from 'typeorm';
import type { Investor } from './investor.entity';

@Entity('karvy_investor_transactions')
@Index(['transaction_number', 'folio_number'])
export class KarvyInvestorTransaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    company_arn_id: string;

    @Column({ nullable: true })
    serial_number: string;

    @Column({ nullable: true })
    product_code: string;

    @Column({ nullable: true })
    fund: string;

    @Column({ nullable: true })
    folio_number: string;

    @Column({ nullable: true })
    scheme_code: string;

    @Column({ nullable: true })
    dividend_option: string;

    @Column({ nullable: true })
    fund_description: string;

    @Column({ nullable: true })
    transaction_head: string;

    @Column({ nullable: true })
    transaction_number: string;

    @Column({ nullable: true })
    switch_ref_no: string;

    @Column({ nullable: true })
    instrument_number: string;

    @Column({ nullable: true })
    investor_name: string;

    @Column({ nullable: true })
    joint_name_1: string;

    @Column({ nullable: true })
    joint_name_2: string;

    @Column({ nullable: true })
    address_1: string;

    @Column({ nullable: true })
    address_2: string;

    @Column({ nullable: true })
    address_3: string;

    @Column({ nullable: true })
    city: string;

    @Column({ nullable: true })
    pincode: string;

    @Column({ nullable: true })
    state: string;

    @Column({ nullable: true })
    country: string;

    @Column({ type: 'date', nullable: true })
    date_of_birth: Date;

    @Column({ nullable: true })
    phone_residence: string;

    @Column({ nullable: true })
    phone_res1: string;

    @Column({ nullable: true })
    phone_res2: string;

    @Column({ nullable: true })
    mobile: string;

    @Column({ nullable: true })
    phone_office: string;

    @Column({ nullable: true })
    phone_off1: string;

    @Column({ nullable: true })
    phone_off2: string;

    @Column({ nullable: true })
    fax_residence: string;

    @Column({ nullable: true })
    fax_office: string;

    @Column({ nullable: true })
    tax_status: string;

    @Column({ nullable: true })
    occ_code: string;

    @Column({ nullable: true })
    email: string;

    @Column({ nullable: true })
    bank_acc_no: string;

    @Column({ nullable: true })
    bank_name: string;

    @Column({ nullable: true })
    account_type: string;

    @Column({ nullable: true })
    branch: string;

    @Column({ nullable: true })
    bank_address_1: string;

    @Column({ nullable: true })
    bank_address_2: string;

    @Column({ nullable: true })
    bank_address_3: string;

    @Column({ nullable: true })
    bank_city: string;

    @Column({ nullable: true })
    bank_phone: string;

    @Column({ nullable: true })
    pan_number: string;

    @Column({ nullable: true })
    transaction_mode: string;

    @Column({ nullable: true })
    transaction_status: string;

    @Column({ nullable: true })
    branch_name: string;

    @Column({ nullable: true })
    branch_transaction_no: string;

    @Column({ type: 'date', nullable: true })
    transaction_date: Date;

    @Column({ type: 'date', nullable: true })
    process_date: Date;

    @Column({ type: 'decimal', precision: 20, scale: 4, nullable: true })
    price: number;

    @Column({ nullable: true })
    load_percentage: string;

    @Column({ type: 'decimal', precision: 20, scale: 4, nullable: true })
    units: number;

    @Column({ type: 'decimal', precision: 20, scale: 4, nullable: true })
    amount: number;

    @Column({ nullable: true })
    load_amount: string;

    @Column({ nullable: true })
    agent_code: string;

    @Column({ nullable: true })
    sub_broker_code: string;

    @Column({ nullable: true })
    brokerage_percentage: string;

    @Column({ type: 'decimal', precision: 20, scale: 4, nullable: true })
    commission: number;

    @Column({ nullable: true })
    karvy_investor_id: string; // From Excel 'Investor ID'

    @Column({ nullable: true })
    investor_id: string; // Internal Link

    @ManyToOne('Investor', { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'investor_id' })
    investor: Investor;

    @Column({ type: 'date', nullable: true })
    report_date: Date;


    @Column({ nullable: true })
    report_time: string;

    @Column({ nullable: true })
    transaction_sub: string;

    @Column({ nullable: true })
    application_number: string;

    @Column({ nullable: true })
    transaction_id_external: string; // Renamed to avoid confusion with internal ID if any

    @Column({ nullable: true })
    transaction_description: string;

    @Column({ nullable: true })
    transaction_type: string;

    @Column({ nullable: true })
    org_purchase_date: string;

    @Column({ nullable: true })
    org_purchase_amount: string;

    @Column({ nullable: true })
    org_purchase_units: string;

    @Column({ nullable: true })
    tr_type_flag: string;

    @Column({ nullable: true })
    switch_fund_date: string;

    @Column({ type: 'date', nullable: true })
    instrument_date: Date;

    @Column({ nullable: true })
    instrument_bank: string;

    @Column({ nullable: true })
    remarks: string;

    @Column({ nullable: true })
    scheme: string;

    @Column({ nullable: true })
    plan: string;

    @Column({ type: 'decimal', precision: 20, scale: 4, nullable: true })
    nav: number;

    @Column({ nullable: true })
    annualized: string;

    @Column({ nullable: true })
    annualized_commission: string;

    @Column({ nullable: true })
    original_purchase_tranx_no: string;

    @Column({ nullable: true })
    original_purchase_branch: string;

    @Column({ nullable: true })
    old_account_number: string;

    @Column({ nullable: true })
    ihno: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}
