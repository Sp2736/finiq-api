import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { SubBroker } from './sub-broker.entity';

@Entity('commission_mappings')
export class CommissionMapping {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    broker_id: string; // The parent broker/master

    @Column({ type: 'uuid' })
    sub_broker_id: string; // The sub-broker

    @Column({ type: 'numeric', precision: 5, scale: 2 })
    share_percentage: number;

    @ManyToOne(() => SubBroker)
    @JoinColumn({ name: 'broker_id' })
    broker: SubBroker;

    @ManyToOne(() => SubBroker)
    @JoinColumn({ name: 'sub_broker_id' })
    sub_broker: SubBroker;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}
