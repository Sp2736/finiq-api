import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('karvy_brokerage_data')
export class KarvyBrokerageData {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    company_id: string;

    @Column({ type: 'uuid', nullable: true })
    investor_id: string;

    @Column({ nullable: true })
    product_code: string;

    @Column({ nullable: true })
    fund_description: string;

    @Column({ nullable: true })
    fund: string;

    @Column({ nullable: true })
    scheme: string;

    @Column({ nullable: true })
    plan: string;

    @Column({ nullable: true })
    option: string;

    @Index()
    @Column({ nullable: true })
    account_number: string;

    @Column({ nullable: true })
    application_number: string;

    @Column({ nullable: true })
    investor_name: string;

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
    transaction_description: string;

    @Column({ type: 'date', nullable: true })
    from_date: Date;

    @Column({ type: 'date', nullable: true })
    to_date: Date;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    amount_in_rs: number;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    units: number;

    @Column({ type: 'date', nullable: true })
    transaction_date: Date;

    @Column({ type: 'date', nullable: true })
    process_date: Date;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    percentage_pct: number;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    brokerage_in_rs: number;

    @Column({ nullable: true })
    sub_broker: string;

    @Column({ type: 'bigint', nullable: true, transformer: { to: v => v, from: v => v ? parseInt(v) : null } })
    account_type: number;

    @Column({ nullable: true })
    brokerage_head: string;

    @Index()
    @Column({ nullable: true })
    transaction_number: string;

    @Column({ nullable: true })
    branch_code: string;

    @Column({ nullable: true })
    cheque_number: string;

    @Column({ type: 'date', nullable: true })
    starting_date: Date;

    @Column({ type: 'date', nullable: true })
    ending_date: Date;

    @Column({ nullable: true })
    warrant_number: string;

    @Column({ type: 'date', nullable: true })
    warrant_date: Date;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    daily_product: number;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    cumulative_nav: number;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    average_assets: number;

    @Column({ nullable: true })
    transaction_id: string;

    @Column({ nullable: true })
    scheme_code: string;

    @Column({ nullable: true })
    transaction_head: string;

    @Column({ nullable: true })
    fee_type: string;

    @Column({ nullable: true })
    adjustment_flag: string;

    @Column({ nullable: true })
    switch_flag: string;

    @Column({ nullable: true })
    brokerage_type: string;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    grossbrokerage: number;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    sttamount: number;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    educessamount: number;

    @Column({ nullable: true })
    broker_code: string;

    @Column({ nullable: true })
    valuedate: string;

    @Column({ nullable: true })
    dpid: string;

    @Column({ nullable: true })
    clientid: string;

    @Column({ type: 'bigint', nullable: true, transformer: { to: v => v, from: v => v ? parseInt(v) : null } })
    ihno: number;

    @Column({ nullable: true })
    prxybranch: string;

    @Column({ nullable: true })
    invcityname: string;

    @Column({ nullable: true })
    invcitycategory: string;

    @Column({ type: 'date', nullable: true })
    navdate: Date;

    @Column({ nullable: true })
    trantypecode: string;

    @Column({ nullable: true })
    assettype: string;

    @Column({ type: 'date', nullable: true })
    redtrdt: Date;

    @Column({ type: 'bigint', nullable: true, transformer: { to: v => v, from: v => v ? parseInt(v) : null } })
    redtrno: number;

    @Column({ nullable: true })
    redtrtype: string;

    @Column({ nullable: true })
    redbranch: string;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    redunits: number;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    redamt: number;

    @Column({ nullable: true })
    recoverytype: string;

    @Column({ nullable: true })
    recoveryremarks: string;

    @Column({ nullable: true })
    invpan: string;

    @Column({ nullable: true })
    brkpan: string;

    @Column({ nullable: true })
    euin: string;

    @Column({ nullable: true })
    benacno: string;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    redcrunits: number;

    @Column({ type: 'bigint', nullable: true, transformer: { to: v => v, from: v => v ? parseInt(v) : null } })
    clbperiod: number;

    @Column({ type: 'bigint', nullable: true, transformer: { to: v => v, from: v => v ? parseInt(v) : null } })
    clbslabmaxperiod: number;

    @Column({ nullable: true })
    clbfromdt: string;

    @Column({ type: 'bigint', nullable: true, transformer: { to: v => v, from: v => v ? parseInt(v) : null } })
    clbdays: number;

    @Column({ nullable: true })
    purbroktype: string;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    purnetamt: number;

    @Column({ nullable: true })
    inwardno: string;

    @Column({ nullable: true })
    subtrtype: string;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    pur_gross_amount: number;

    @Column({ type: 'date', nullable: true })
    sipregdate: Date;

    @Column({ nullable: true })
    agentcity: string;

    @Column({ nullable: true })
    agentstate: string;

    @Column({ nullable: true })
    agentbranch: string;

    @Column({ nullable: true })
    amccity: string;

    @Column({ nullable: true })
    amcstate: string;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    cgstrate: number;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    cgstamt: number;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    sgstrate: number;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    sgstamt: number;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    igstrate: number;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    igstamt: number;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    ugstrate: number;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    ugstamt: number;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    totgstrate: number;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    totgstamt: number;

    @Column({ nullable: true })
    gstamcschemeflag: string;

    @Column({ nullable: true })
    gstregno: string;

    @Column({ nullable: true })
    paymentdt: string;

    @Column({ nullable: true })
    amc_scheme_bifurcation_gst_reg_number: string;

    @Column({ nullable: true })
    gst_applicable_flag_for_transaction: string;

    @Column({ nullable: true })
    purchase_trxn_type: string;

    @Column({ type: 'bigint', nullable: true, transformer: { to: v => v, from: v => v ? parseInt(v) : null } })
    purchase_trxn_no: number;

    @Column({ nullable: true })
    investor_category: string;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    purchase_trxn_unit: number;

    @Column({ type: 'date', nullable: true })
    purchase_trxn_date: Date;

    @Column({ type: 'numeric', precision: 20, scale: 6, nullable: true, transformer: { to: v => v, from: v => v ? parseFloat(v) : null } })
    purchase_trxn_amt: number;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}
