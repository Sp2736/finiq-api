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

@Entity('cams_sip_stp_details')
@Unique(['auto_trno', 'amc_code'])
export class CamsSipStpDetail {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    company_arn_id: string;

    @ManyToOne('CompanyArn', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_arn_id' })
    company_arn: CompanyArn;

    // Scheme and Folio Information
    @Column({ nullable: true, length: 255 })
    scheme: string;

    @Column({ nullable: true, length: 100 })
    folio_no: string;

    @Column({ nullable: true, length: 255 })
    inv_name: string;

    // Transaction Details
    @Column({ nullable: true, length: 50 })
    aut_trntyp: string;

    @Column({ length: 100 })
    auto_trno: string;

    @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
    auto_amount: number;

    // Dates (Stored as dates, parsed from Excel serials)
    @Column({ type: 'date', nullable: true })
    from_date: Date;

    @Column({ type: 'date', nullable: true })
    to_date: Date;

    @Column({ type: 'date', nullable: true })
    cease_date: Date;

    @Column({ type: 'date', nullable: true })
    reg_date: Date;

    // Plan Details
    @Column({ nullable: true, length: 50 })
    periodicity: string;

    @Column({ nullable: true, length: 50 })
    period_day: string;

    @Column({ nullable: true, length: 100 })
    inv_iin: string;

    @Column({ nullable: true, length: 100 })
    payment_mode: string;

    @Column({ nullable: true, length: 255 })
    target_scheme: string;

    @Column({ nullable: true, length: 255 })
    subbroker: string;

    @Column({ type: 'text', nullable: true })
    remarks: string;

    // Top-up Settings
    @Column({ nullable: true, length: 50 })
    top_up_frq: string;

    @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
    top_up_amt: number;

    @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
    top_up_perc: number;

    // Bank Information
    @Column({ nullable: true, length: 50 })
    ac_type: string;

    @Column({ nullable: true, length: 255 })
    bank: string;

    @Column({ nullable: true, length: 255 })
    branch: string;

    @Column({ nullable: true, length: 100 })
    instrm_no: string;

    @Column({ nullable: true, length: 50 })
    cheq_micr_no: string;

    @Column({ nullable: true, length: 255 })
    ac_holder_name: string;

    // Codes and IDs
    @Column({ nullable: true, length: 20 })
    pan: string;

    @Column({ nullable: true, length: 100 })
    euin: string;

    @Column({ nullable: true, length: 100 })
    sub_arn_code: string;

    @Column({ nullable: true, length: 100 })
    ter_location: string;

    @Column({ nullable: true, length: 50 })
    scheme_code: string;

    @Column({ nullable: true, length: 50 })
    target_scheme_code: string;

    @Column({ nullable: true, length: 50 })
    amc_code: string;

    @Column({ nullable: true, length: 100 })
    user_code: string;

    @Column({ nullable: true, length: 255 })
    package_name: string;

    @Column({ nullable: true, length: 255 })
    special_product: string;

    @Column({ nullable: true, length: 255 })
    subtrxndesc: string;

    @Column({ type: 'date', nullable: true })
    pause_from_date: Date;

    @Column({ type: 'date', nullable: true })
    pause_to_date: Date;

    @Column({ nullable: true, length: 100 })
    folio_old: string;

    @Column({ nullable: true, length: 255 })
    ft_sip_regno: string;

    @Column({ nullable: true, length: 100 })
    scheme_folio_number: string;

    @Column({ nullable: true, length: 100 })
    request_ref_no: string;

    // Metadata
    @Column({ nullable: true })
    request_id: string;

    @Column({ nullable: true })
    file_name: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}
