import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn
} from 'typeorm';
import { Investor } from './investor.entity';
import { SubBroker } from './sub-broker.entity';
import { UserProfile } from './user-profile.entity';
import { Company } from './company.entity';

export enum MappingAction {
    ASSIGNED = 'ASSIGNED',
    UNASSIGNED = 'UNASSIGNED',
}

@Entity('investor_mapping_history')
export class InvestorMappingHistory {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    company_id: string;

    @ManyToOne(() => Company, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'company_id' })
    company: Company;

    @Column({ name: 'investor_id' })
    investor_id: string;

    @ManyToOne(() => Investor, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'investor_id' })
    investor: Investor;

    @Column({ name: 'sub_broker_id' })
    sub_broker_id: string;

    @ManyToOne(() => SubBroker, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sub_broker_id' })
    sub_broker: SubBroker;

    @Column({
        type: 'enum',
        enum: MappingAction,
    })
    action: MappingAction;

    @Column()
    performed_by_id: string; // UserProfile ID of the admin who performed the action

    @ManyToOne(() => UserProfile)
    @JoinColumn({ name: 'performed_by_id' })
    performed_by: UserProfile;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;
}
