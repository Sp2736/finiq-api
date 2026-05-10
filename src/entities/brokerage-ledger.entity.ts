import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { CamsBrokerageData } from './cams-brokerage-data.entity';
import { SubBroker } from './sub-broker.entity';

@Entity('brokerage_ledger')
export class BrokerageLedger {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    original_brokerage_id: string;

    @Column({ type: 'uuid' })
    broker_id: string;

    @Column({ type: 'numeric', precision: 18, scale: 4 })
    amount_earned: number;

    @Column({ type: 'integer' })
    level_in_hierarchy: number;

    @ManyToOne(() => CamsBrokerageData)
    @JoinColumn({ name: 'original_brokerage_id' })
    original_brokerage: CamsBrokerageData;

    @ManyToOne(() => SubBroker)
    @JoinColumn({ name: 'broker_id' })
    broker: SubBroker;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}
