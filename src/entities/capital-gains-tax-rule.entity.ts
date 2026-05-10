import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('capital_gains_tax_rules')
export class CapitalGainsTaxRule {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 50 })
    asset_class: string; // e.g., 'EQUITY', 'DEBT'

    @Column({ type: 'varchar', length: 10 })
    tax_type: 'STCG' | 'LTCG'; // Short-Term or Long-Term

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    rate_percentage: number;

    @Column({ type: 'date' })
    effective_from: Date;

    @Column({ type: 'date', nullable: true })
    effective_till: Date;

    @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
    exemption_limit: number; // e.g., 125000 for equity LTCG

    @Column({ type: 'boolean', default: false })
    indexation_benefit: boolean;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}
