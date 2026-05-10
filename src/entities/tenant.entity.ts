import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from 'typeorm';
import type { Company } from './company.entity';

export enum SubscriptionPlan {
    BASIC = 'BASIC',
    PROFESSIONAL = 'PROFESSIONAL',
    ENTERPRISE = 'ENTERPRISE',
}

@Entity('tenants')
export class Tenant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ unique: true })
    email: string;

    @Column({ nullable: true })
    phone_number: string;

    @Column({
        type: 'enum',
        enum: SubscriptionPlan,
        default: SubscriptionPlan.BASIC,
    })
    subscription_plan: SubscriptionPlan;

    @Column({ default: 1 })
    company_limit: number;

    @Column({ type: 'timestamp with time zone', nullable: true })
    subscription_expiry: Date;

    @Column({ default: true })
    is_active: boolean;

    @OneToMany('Company', (company: Company) => company.tenant)
    companies: Company[];

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}
