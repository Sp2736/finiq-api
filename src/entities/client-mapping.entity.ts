import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { SubBroker } from './sub-broker.entity';
import { Investor } from './investor.entity'; // assuming investor exists based on folder name

@Entity('client_mappings')
export class ClientMapping {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    @Index({ unique: true })
    client_id: string;

    @Column({ type: 'uuid' })
    sub_broker_id: string;

    @ManyToOne(() => Investor)
    @JoinColumn({ name: 'client_id' })
    client: Investor;

    @ManyToOne(() => SubBroker)
    @JoinColumn({ name: 'sub_broker_id' })
    sub_broker: SubBroker;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updated_at: Date;
}
