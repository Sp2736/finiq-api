import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    ManyToOne,
    JoinColumn
} from 'typeorm';
import type { CamsInvestorStaticDetail } from './cams-investor-static-detail.entity';
import type { CamsInvestorTransaction } from './cams-investor-transaction.entity';
import type { Company } from './company.entity';
import { InvestorMapping } from './investor-mapping.entity';

@Entity('investors')
export class Investor {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'company_id', type: 'uuid' })
    company_id: string;

    @ManyToOne('Company', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_id' })
    company: Company;

    @Column({ name: 'arn', type: 'varchar', nullable: true, length: 255 })
    arn?: string | null;

    @Column({ name: 'investor_name', type: 'varchar', nullable: true, length: 255 })
    name?: string | null;

    @Column({ name: 'pan_no', type: 'varchar', length: 20 })
    pan: string;

    @Column({ name: 'is_guest_pan', type: 'boolean', default: false })
    is_guest_pan: boolean;

    @Column({ type: 'date', nullable: true })
    date_of_birth?: Date | null;

    @Column({ name: 'email', type: 'varchar', nullable: true, length: 255 })
    email?: string | null;

    @Column({ name: 'mobile_no', type: 'varchar', nullable: true, length: 50 })
    mobile?: string | null;

    @Column({ name: 'guardian_name', type: 'varchar', nullable: true, length: 255 })
    guardian_name?: string | null;

    @Column({ name: 'guardian_pan', type: 'varchar', nullable: true, length: 20 })
    guardian_pan?: string | null;

    @Column({ name: 'username', type: 'varchar', nullable: true, length: 100 })
    username?: string | null;

    @Column({ name: 'password_hash', type: 'varchar', nullable: true, length: 255, select: false })
    password_hash?: string | null;

    @Column({ name: 'must_change_password', type: 'boolean', default: false })
    must_change_password: boolean;

    @Column({ name: 'tax_status', type: 'varchar', nullable: true, length: 100 })
    tax_status?: string | null;

    @Column({ name: 'tax_status_label', type: 'varchar', nullable: true, length: 255 })
    tax_status_label?: string | null;

    @CreateDateColumn({ name: 'first_seen_at', type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ name: 'last_updated_at', type: 'timestamp with time zone' })
    updated_at: Date;

    // Relations
    @OneToMany('CamsInvestorStaticDetail', 'investor')
    static_details: CamsInvestorStaticDetail[];

    @OneToMany('CamsInvestorTransaction', 'investor')
    transactions: CamsInvestorTransaction[];

    @OneToMany(() => InvestorMapping, (mapping) => mapping.investor)
    mappings: InvestorMapping[];
}
