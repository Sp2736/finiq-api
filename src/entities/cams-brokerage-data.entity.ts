import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';

@Entity('cams_brokerage_data')
@Index(['amc_code', 'folio_no', 'trxn_no', 'brkage_type', 'brk_pay_dt'], { unique: true })
export class CamsBrokerageData {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    company_id: string;

    @Column({ type: 'uuid', nullable: true })
    investor_id: string;

    @Column({ nullable: true })
    amc_code: string;

    @Column({ type: 'date', nullable: true })
    proc_date: Date;

    @Column({ nullable: true })
    folio_no: string;

    @Column({ nullable: true })
    scheme_code: string;

    @Column({ nullable: true })
    trxn_type: string;

    @Column({ nullable: true })
    trxn_no: string;

    @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    plot_amount: number;

    @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    plot_units: number;

    @Column({ type: 'date', nullable: true })
    post_date: Date;

    @Column({ type: 'timestamp', nullable: true })
    trade_date_time: Date;

    @Column({ type: 'date', nullable: true })
    entry_date: Date;

    @Column({ nullable: true })
    user_code: string;

    @Column({ nullable: true })
    user_trxnno: string;

    @Column({ nullable: true })
    trxn_nature: string;

    @Column({ nullable: true })
    ter_location: string;

    @Column({ type: 'date', nullable: true })
    sys_reg_date: Date;

    @Column({ nullable: true })
    aut_txn_no: string;

    @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    auto_amount: number;

    @Column({ nullable: true })
    aut_txn_type: string;

    @Column({ type: 'date', nullable: true })
    cease_date: Date;

    @Column({ type: 'date', nullable: true })
    remed_date: Date;

    @Column({ type: 'date', nullable: true })
    forf_date: Date;

    @Column({ nullable: true })
    src_brk_code: string;

    @Column({ nullable: true })
    brok_code: string;

    @Column({ nullable: true })
    brh_code: string;

    @Column({ nullable: true })
    sub_brk_arn: string;

    @Column({ nullable: true })
    ae_code: string;

    @Column({ nullable: true })
    arn_emp_code: string;

    @Column({ nullable: true })
    euin_opted: string;

    @Column({ nullable: true })
    euin_valid: string;

    @Column({ nullable: true })
    brk_comm_paid: string;

    @Column({ nullable: true })
    adj_flag: string;

    @Column({ nullable: true })
    brkage_type: string;

    @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    brkage_rate: number;

    @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    total_upfront: number;

    @Column({ nullable: true })
    defer_frequency: string;

    @Column({ type: 'integer', nullable: true })
    defer_no_of_installment: number;

    @Column({ type: 'integer', nullable: true })
    pay_installment_no: number;

    @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    brkage_amt: number;

    @Column({ type: 'date', nullable: true })
    brkage_from: Date;

    @Column({ type: 'date', nullable: true })
    brkage_to: Date;

    @Column({ type: 'date', nullable: true })
    proc_from_date: Date;

    @Column({ type: 'date', nullable: true })
    proc_to_date: Date;

    @Column({ type: 'text', nullable: true })
    trxn_desc: string;

    @Column({ nullable: true })
    spl_upf_tenure: string;

    @Column({ type: 'date', nullable: true })
    upf_tenure_end_date: Date;

    @Column({ type: 'date', nullable: true })
    brk_pay_dt: Date;

    @Column({ nullable: true })
    clw_type: string;

    @Column({ nullable: true })
    clw_period: string;

    @Column({ nullable: true })
    rec_flag: string;

    @Column({ type: 'date', nullable: true })
    p_si_date: Date;

    @Column({ nullable: true })
    rec_period: string;

    @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    clw_amt: number;

    @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    upf_paid: number;

    @Column({ nullable: true })
    fee_id: string;

    @Column({ nullable: true })
    am_code: string;

    @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    am_comm: number;

    @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    am_rate: number;

    @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    avg_assets: number;

    @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    cam_comm: number;

    @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    cam_rate: number;

    @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    mam_comm: number;

    @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    mam_rate: number;

    @Column({ type: 'integer', nullable: true })
    no_of_days: number;

    @Column({ nullable: true })
    brok_gst_state_code: string;

    @Column({ type: 'numeric', precision: 10, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    igst_rate: number;

    @Column({ type: 'numeric', precision: 10, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    cgst_rate: number;

    @Column({ type: 'numeric', precision: 10, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    sgst_rate: number;

    @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    igst_value: number;

    @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    cgst_value: number;

    @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: { to: v => v, from: v => parseFloat(v) } })
    sgst_value: number;

    @Column({ type: 'text', nullable: true })
    remarks: string;

    @Column({ nullable: true })
    inv_name: string;

    @Column({ nullable: true })
    request_ref_no: string;

    @Column({ type: 'date', nullable: true })
    brokerage_acrual_month: Date;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}