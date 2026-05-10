import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    JoinColumn,
} from 'typeorm';
import type { Company } from './company.entity';

@Entity('company_details')
export class CompanyDetail {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    company_id: string;

    @OneToOne('Company', 'details', {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'company_id' })
    company: Company;

    @Column({ nullable: true })
    registration_number: string;

    @Column({ nullable: true })
    gst_no: string;

    @Column({ nullable: true })
    address_line1: string;

    @Column({ nullable: true })
    address_line2: string;

    @Column({ nullable: true })
    city: string;

    @Column({ nullable: true })
    state: string;

    @Column({ nullable: true })
    pincode: string;

    @Column({ default: 'India' })
    country: string;
}
