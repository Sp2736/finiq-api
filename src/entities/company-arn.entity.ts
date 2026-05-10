import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import type { Company } from './company.entity';

@Entity('company_arns')
export class CompanyArn {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    company_id: string;

    @ManyToOne('Company', (company: Company) => company.arns, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_id' })
    company: Company;

    @Column({ name: 'arn_no', nullable: true })
    arnNo?: string;

    @Column({ default: true })
    is_active: boolean;

    @Column({ nullable: true })
    euin: string;

    @Column({ nullable: true })
    email: string;

    @Column({ nullable: true })
    phone: string;

    // Email Configuration for Automated Data Feeds
    @Column({ nullable: true })
    email_host: string;

    @Column({ type: 'int', nullable: true })
    email_port: number;

    @Column({ nullable: true })
    email_user: string;

    @Column({ nullable: true, select: false })
    email_password: string;

    @Column({ default: true })
    email_use_ssl: boolean;

    @Column({ nullable: true })
    cams_zip_password: string;

    // Storing Source-specific credentials as JSONB for flexibility
    @Column({ type: 'jsonb', nullable: true })
    credentials: {
        source: string;
        mailback_pass?: string | null;
        camsonline_pass?: string | null;
        fundsnet_pass?: string | null;
    }[];
}
