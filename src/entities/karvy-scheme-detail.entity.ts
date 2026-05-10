import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('karvy_scheme_details')
@Index(['product_code'])
export class KarvySchemeDetail {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'product_code', unique: true })
    product_code: string;

    @Column({ name: 'amc_code', nullable: true })
    amc_code: string;

    @Column({ name: 'amc_name', nullable: true })
    amc_name: string;

    @Column({ name: 'scheme_code', nullable: true })
    scheme_code: string;

    @Column({ name: 'scheme_description', length: 500, nullable: true })
    scheme_description: string;

    @Column({ name: 'plan_code', nullable: true })
    plan_code: string;

    @Column({ name: 'plan_description', length: 255, nullable: true })
    plan_description: string;

    @Column({ name: 'option_code', nullable: true })
    option_code: string;

    @Column({ name: 'option_description', length: 255, nullable: true })
    option_description: string;

    @Column({ name: 'nature', nullable: true })
    nature: string;

    @Column({ name: 'fund_type', nullable: true })
    fund_type: string;

    // Excel dates are often numeric but string parsing is safer or date
    @Column({ name: 'nfo_start_date', nullable: true })
    nfo_start_date: string;

    @Column({ name: 'nfo_end_date', nullable: true })
    nfo_end_date: string;

    @Column({ name: 'open_date', nullable: true })
    open_date: string;

    @Column({ name: 'close_date', nullable: true })
    close_date: string;

    @Column({ name: 'isin_number', nullable: true })
    isin_number: string;

    @Column({ name: 'isin_type', nullable: true })
    isin_type: string;

    @Column({ name: 'purchased_allowed', nullable: true })
    purchased_allowed: string;

    @Column({ name: 'ipo_amount', type: 'numeric', precision: 20, scale: 4, nullable: true })
    ipo_amount: number;

    @Column({ name: 'ipo_min_amount', type: 'numeric', precision: 20, scale: 4, nullable: true })
    ipo_min_amount: number;

    @Column({ name: 'ipo_multiple_amount', type: 'numeric', precision: 20, scale: 4, nullable: true })
    ipo_multiple_amount: number;

    @Column({ name: 'new_purchase_amount', type: 'numeric', precision: 20, scale: 4, nullable: true })
    new_purchase_amount: number;

    @Column({ name: 'new_purchase_multiple_amount', type: 'numeric', precision: 20, scale: 4, nullable: true })
    new_purchase_multiple_amount: number;

    @Column({ name: 'nri_new_min_amount', type: 'numeric', precision: 20, scale: 4, nullable: true })
    nri_new_min_amount: number;

    @Column({ name: 'nri_new_multiple_amount', type: 'numeric', precision: 20, scale: 4, nullable: true })
    nri_new_multiple_amount: number;

    @Column({ name: 'add_purchase_amount', type: 'numeric', precision: 20, scale: 4, nullable: true })
    add_purchase_amount: number;

    @Column({ name: 'add_purchase_multiple_amount', type: 'numeric', precision: 20, scale: 4, nullable: true })
    add_purchase_multiple_amount: number;

    @Column({ name: 'redemption_allowed', nullable: true })
    redemption_allowed: string;

    @Column({ name: 'redemption_min_amount', type: 'numeric', precision: 20, scale: 4, nullable: true })
    redemption_min_amount: number;

    @Column({ name: 'redemption_multiple_amount', type: 'numeric', precision: 20, scale: 4, nullable: true })
    redemption_multiple_amount: number;

    @Column({ name: 'redemption_min_units', type: 'numeric', precision: 20, scale: 4, nullable: true })
    redemption_min_units: number;

    @Column({ name: 'redemption_multiple_units', type: 'numeric', precision: 20, scale: 4, nullable: true })
    redemption_multiple_units: number;

    @Column({ name: 'switch_in_allowed', nullable: true })
    switch_in_allowed: string;

    @Column({ name: 'switch_out_allowed', nullable: true })
    switch_out_allowed: string;

    @Column({ name: 'switch_out_min_amount', type: 'numeric', precision: 20, scale: 4, nullable: true })
    switch_out_min_amount: number;

    @Column({ name: 'switch_in_min_amount', type: 'numeric', precision: 20, scale: 4, nullable: true })
    switch_in_min_amount: number;

    @Column({ name: 'lateral_in_allowed', nullable: true })
    lateral_in_allowed: string;

    @Column({ name: 'lateral_out_allowed', nullable: true })
    lateral_out_allowed: string;

    @Column({ name: 'stp_in_allowed', nullable: true })
    stp_in_allowed: string;

    @Column({ name: 'stp_out_allowed', nullable: true })
    stp_out_allowed: string;

    @Column({ name: 'stp_frequency', nullable: true })
    stp_frequency: string;

    @Column({ name: 'stp_min_amount', type: 'numeric', precision: 20, scale: 4, nullable: true })
    stp_min_amount: number;

    @Column({ name: 'stp_dates', nullable: true })
    stp_dates: string;

    @Column({ name: 'sip_allowed', nullable: true })
    sip_allowed: string;

    @Column({ name: 'sip_min_amount', type: 'numeric', precision: 20, scale: 4, nullable: true })
    sip_min_amount: number;

    @Column({ name: 'sip_dates', nullable: true })
    sip_dates: string;

    @Column({ name: 'sip_frequency', nullable: true })
    sip_frequency: string;

    @Column({ name: 'swp_in_allowed', nullable: true })
    swp_in_allowed: string;

    @Column({ name: 'swp_out_allowed', nullable: true })
    swp_out_allowed: string;

    @Column({ name: 'swp_frequency', nullable: true })
    swp_frequency: string;

    @Column({ name: 'swp_min_amount', type: 'numeric', precision: 20, scale: 4, nullable: true })
    swp_min_amount: number;

    @Column({ name: 'swp_dates', nullable: true })
    swp_dates: string;

    @Column({ name: 'load_details', type: 'text', nullable: true })
    load_details: string;

    @Column({ name: 'purchase_cutoff_time', nullable: true })
    purchase_cutoff_time: string;

    @Column({ name: 'redemption_cutoff_time', nullable: true })
    redemption_cutoff_time: string;

    @Column({ name: 'switch_cutoff_time', nullable: true })
    switch_cutoff_time: string;

    @Column({ name: 'maturity_date', nullable: true })
    maturity_date: string;

    @Column({ name: 're_open_date', nullable: true })
    re_open_date: string;

    @Column({ name: 'nfo_face_value', nullable: true })
    nfo_face_value: string;

    @Column({ name: 'demat_allowed', nullable: true })
    demat_allowed: string;

    @Column({ name: 'risk_type', nullable: true })
    risk_type: string;

    @Column({ name: 'allotment_date', nullable: true })
    allotment_date: string;

    @Column({ name: 'last_update_date', nullable: true })
    last_update_date: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}
