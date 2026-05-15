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

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum PaymentMode {
  UPI = 'UPI',
  NEFT = 'NEFT',
  RTGS = 'RTGS',
  IMPS = 'IMPS',
  CHEQUE = 'CHEQUE',
}

@Entity('broker_transactions')
export class BrokerTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  sub_broker_id: string;

  @ManyToOne(() => SubBroker)
  @JoinColumn({ name: 'sub_broker_id' })
  sub_broker: SubBroker;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  transaction_date: Date;

  @Column({ type: 'enum', enum: PaymentMode })
  payment_mode: PaymentMode;

  @Column({ type: 'varchar', length: 100, unique: true })
  transaction_id: string; // Bank Reference / UTR

  @Column({ type: 'varchar', length: 100, nullable: true })
  upi_id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  source_account: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  destination_account: string;

  @Column({ type: 'text', nullable: true })
  description: string; // "October 2025 Commission Payout"

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
