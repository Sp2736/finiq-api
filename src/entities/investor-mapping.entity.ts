import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Unique,
} from 'typeorm';
import { Investor } from './investor.entity';
import { SubBroker } from './sub-broker.entity';
import { Company } from './company.entity';

@Entity('investor_mappings')
@Unique(['investor_id', 'sub_broker_id']) // Prevent duplicate active mappings
export class InvestorMapping {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    company_id: string;

    @ManyToOne(() => Company, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_id' })
    company: Company;

    @Column({ name: 'investor_id' })
    investor_id: string;

    @ManyToOne(() => Investor, (investor) => investor.mappings, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'investor_id' })
    investor: Investor;

    @Column({ name: 'sub_broker_id' })
    sub_broker_id: string;

    @ManyToOne(() => SubBroker, (subBroker) => subBroker.mappings, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sub_broker_id' })
    sub_broker: SubBroker;

    @Column({ default: true })
    is_active: boolean;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}
