import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { InvestorMapping } from './investor-mapping.entity';
import { User } from './user.entity';

@Entity('sub_brokers')
export class SubBroker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  arn_id: string;

  @Column({ type: 'uuid', nullable: true })
  company_id: string;

  @Column({ type: 'uuid', nullable: true })
  parent_id: string;

  @ManyToOne(() => SubBroker, (subBroker) => subBroker.children)
  @JoinColumn({ name: 'parent_id' })
  parent: SubBroker;

  @OneToMany(() => SubBroker, (subBroker) => subBroker.parent)
  children: SubBroker[];

  // Path enumeration field (e.g., "id1/id2/id3")
  @Column({ nullable: true })
  path: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @OneToMany(() => InvestorMapping, (mapping) => mapping.sub_broker)
  mappings: InvestorMapping[];

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
