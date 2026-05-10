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

@Entity('karvy_sip_registrations')
@Index(['reg_sl_no'])
export class KarvySipRegistration {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    company_arn_id: string;

    @Column({ nullable: true })
    investor_id: string;

    @ManyToOne('Investor', { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'investor_id' })
    investor: Investor;

    @Column({ nullable: true })
    zone: string;

    @Column({ nullable: true })
    branch: string;

    @Column({ nullable: true })
    location: string;

    @Column({ nullable: true })
    ihno: string;

    @Column({ nullable: true })
    folio_number: string;

    @Column({ nullable: true })
    investor_name: string;

    @Column({ type: 'date', nullable: true })
    registration_date: Date;

    @Column({ type: 'date', nullable: true })
    start_date: Date;

    @Column({ type: 'date', nullable: true })
    end_date: Date;

    @Column({ type: 'int', nullable: true })
    no_of_installments: number;

    @Column({ type: 'decimal', precision: 20, scale: 2, nullable: true })
    amount: number;

    @Column({ nullable: true })
    scheme: string;

    @Column({ nullable: true })
    plan: string;

    @Column({ nullable: true })
    agent_code: string;

    @Column({ nullable: true })
    agent_name: string;

    @Column({ nullable: true })
    sub_broker_code: string;

    @Column({ nullable: true })
    scheme_name: string;

    @Column({ nullable: true })
    pan: string;

    @Column({ nullable: true })
    sip_type: string;

    @Column({ nullable: true })
    sip_mode: string;

    @Column({ nullable: true })
    fund_code: string;

    @Column({ nullable: true })
    product_code: string;

    @Column({ nullable: true })
    frequency: string;

    @Column({ nullable: true })
    transaction_type: string;

    @Column({ nullable: true })
    to_scheme: string;

    @Column({ nullable: true })
    to_plan: string;

    @Column({ type: 'date', nullable: true })
    terminate_date: Date;

    @Column({ nullable: true })
    status: string;

    @Column({ nullable: true })
    to_product_code: string;

    @Column({ nullable: true })
    to_scheme_name: string;

    @Column({ nullable: true })
    ecs_no: string;

    @Column({ nullable: true })
    ecs_bank_name: string;

    @Column({ nullable: true })
    ecs_ac_no: string;

    @Column({ nullable: true })
    ecs_holder_name: string;

    @Column({ nullable: true })
    reg_sl_no: string;

    @Column({ nullable: true })
    inv_dp_id: string;

    @Column({ nullable: true })
    inv_client_id: string;

    @Column({ nullable: true })
    dp_inv_name: string;

    @Column({ nullable: true })
    modify_flag: string;

    @Column({ nullable: true })
    umrn_code: string;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}
