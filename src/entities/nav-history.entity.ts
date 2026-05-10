import { Entity, Column, PrimaryGeneratedColumn, Unique, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('nav_history')
@Unique(['schemeCode', 'navDate'])
export class NavHistory {
    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @Column({ name: 'scheme_code' })
    schemeCode: string;

    @Column({ name: 'isin_payout_growth', nullable: true })
    isinPayoutGrowth: string;

    @Column({ name: 'isin_reinvestment', nullable: true })
    isinReinvestment: string;

    @Column({ name: 'scheme_name' })
    schemeName: string;

    @Column({ type: 'numeric', precision: 15, scale: 6 })
    nav: number;

    @Index()
    @Column({ name: 'nav_date', type: 'date' })
    navDate: Date;

    @Column({ name: 'data_source', default: 'AMFI_HISTORICAL' })
    dataSource: string;

    @Column({ nullable: true })
    category: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
