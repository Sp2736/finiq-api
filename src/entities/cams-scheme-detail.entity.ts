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

@Entity('cams_scheme_details')
@Unique(['amc_code', 'sch_code'])
export class CamsSchemeDetail {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    company_arn_id: string;

    @ManyToOne('CompanyArn', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_arn_id' })
    company_arn: CompanyArn;

    // Scheme Identification
    @Column({ nullable: true })
    amc_code: string;

    @Column({ nullable: true })
    amc: string;

    @Column({ nullable: true })
    sch_code: string;

    @Column({ nullable: true })
    sch_name: string;

    @Column({ nullable: true })
    sch_type: string;

    // Dividend & Reinvestment
    @Column({ nullable: true })
    div_reinv: string;

    // SIP Settings
    @Column({ nullable: true })
    sip_allow: string;

    @Column({ type: 'decimal', nullable: true })
    sip_mn_ins: number;

    @Column({ type: 'decimal', nullable: true })
    sip_mn_amt: number;

    @Column({ type: 'decimal', nullable: true })
    sip_multi: number;

    @Column({ type: 'decimal', nullable: true })
    sip_mx_amt: number;

    @Column({ nullable: true })
    sip_dates: string;

    // Lien
    @Column({ nullable: true })
    lien: string;

    // Switch Settings
    @Column({ nullable: true })
    swt_allow: string;

    @Column({ type: 'decimal', nullable: true })
    swt_mn_amt: number;

    @Column({ type: 'decimal', nullable: true })
    swt_mx_amt: number;

    @Column({ type: 'decimal', nullable: true })
    swt_mn_unt: number;

    @Column({ type: 'decimal', nullable: true })
    swt_mx_unt: number;

    @Column({ nullable: true })
    swi_multi: string;

    // Additional Purchase Settings
    @Column({ type: 'decimal', nullable: true })
    adp_mn_amt: number;

    @Column({ type: 'decimal', nullable: true })
    adp_mx_amt: number;

    @Column({ type: 'decimal', nullable: true })
    adp_mn_unt: number;

    @Column({ type: 'decimal', nullable: true })
    adp_mx_unt: number;

    @Column({ nullable: true })
    adp_mn_inc: string;

    // New Purchase Settings
    @Column({ type: 'decimal', nullable: true })
    newp_mnval: number;

    @Column({ type: 'decimal', nullable: true })
    newp_mxval: number;

    @Column({ type: 'decimal', nullable: true })
    p_mn_incr: number;

    // Redemption Settings
    @Column({ nullable: true })
    red_allow: string;

    @Column({ type: 'decimal', nullable: true })
    red_mn_amt: number;

    @Column({ type: 'decimal', nullable: true })
    red_mx_amt: number;

    @Column({ type: 'decimal', nullable: true })
    red_mn_unt: number;

    @Column({ type: 'decimal', nullable: true })
    red_mx_unt: number;

    @Column({ nullable: true })
    red_incr: string;

    // Purchase Settings
    @Column({ nullable: true })
    pur_allow: string;

    // SWP Settings
    @Column({ nullable: true })
    swp_allow: string;

    @Column({ type: 'decimal', nullable: true })
    mn_swp_amt: number;

    @Column({ type: 'decimal', nullable: true })
    mx_swp_amt: number;

    @Column({ type: 'decimal', nullable: true })
    swp_mn_ins: number;

    @Column({ nullable: true })
    swp_multi: string;

    @Column({ nullable: true })
    swp_dates: string;

    // STP Settings
    @Column({ nullable: true })
    stp_allow: string;

    @Column({ nullable: true })
    stp_dates: string;

    // Scheme Details
    @Column({ nullable: true })
    close_end: string;

    @Column({ nullable: true })
    elss_sch: string;

    @Column({ type: 'date', nullable: true })
    mature_dt: Date;

    @Column({ type: 'decimal', nullable: true })
    face_value: number;

    @Column({ nullable: true })
    asset_class: string;

    @Column({ nullable: true })
    sebi_class: string;

    @Column({ nullable: true })
    settle_per: string;

    @Column({ nullable: true })
    sys_freqs: string;

    // Plan Type
    @Column({ nullable: true })
    plan_type: string;

    // Systematic Features
    @Column({ nullable: true })
    sf_code: string;

    @Column({ nullable: true })
    sf_name: string;

    @Column({ type: 'date', nullable: true })
    start_date: Date;

    // Parent Scheme
    @Column({ nullable: true })
    parent_scheme_code: string;

    @Column({ nullable: true })
    isin_no: string;

    @Column({ nullable: true })
    display_data_entry: string;

    // Metadata
    @Column({ nullable: true })
    request_id: string;

    @Column({ nullable: true })
    file_name: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;
}
