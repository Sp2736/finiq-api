import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Tenant } from './tenant.entity';
import { Company } from './company.entity';

export enum UserRole {
    FINIQ_ADMIN = 'FINIQ_ADMIN',
    TENANT_ADMIN = 'TENANT_ADMIN',
    COMPANY_ADMIN = 'COMPANY_ADMIN',
    COMPANY_USER = 'COMPANY_USER',
    BROKER = 'BROKER',
    SUB_BROKER = 'SUB_BROKER',
}

@Entity('user_profiles')
export class UserProfile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    user_id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({
        type: 'enum',
        enum: UserRole,
    })
    role: UserRole;

    // --- Multi-Tenant Context ---

    @Column({ nullable: true })
    tenant_id: string;

    @ManyToOne(() => Tenant, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'tenant_id' })
    tenant: Tenant;

    @Column({ nullable: true })
    company_id: string;

    @ManyToOne(() => Company, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'company_id' })
    company: Company;

    // --- Personal Details ---
    @Column({ type: 'varchar', nullable: true })
    first_name: string;

    @Column({ type: 'varchar', nullable: true })
    last_name: string;

    @Column({ type: 'varchar', nullable: true })
    email: string;

    @Column({ default: true })
    is_active: boolean;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}
