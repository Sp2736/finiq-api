import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToOne,
    OneToMany,
} from 'typeorm';
import type { Tenant } from './tenant.entity';
import type { CompanyDetail } from './company-detail.entity';
import type { CompanyArn } from './company-arn.entity';

@Entity('companies')
export class Company {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    tenant_id: string;

    @ManyToOne('Tenant', (tenant: Tenant) => tenant.companies, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'tenant_id' })
    tenant: Tenant;

    @Column()
    name: string;

    @Column({ nullable: true })
    email: string;

    @Column({ nullable: true })
    phone_number: string;

    @Column({ nullable: true, unique: true })
    tax_id: string;

    @Column({ default: true })
    is_active: boolean;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;

    @OneToOne('CompanyDetail', (detail: CompanyDetail) => detail.company, { cascade: true })
    details: CompanyDetail;

    @OneToMany('CompanyArn', (arn: CompanyArn) => arn.company, { cascade: true })
    arns: CompanyArn[];
}
