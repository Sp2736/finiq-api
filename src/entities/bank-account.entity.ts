// src/entities/bank-account.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('company_bank_accounts')
export class BankAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  company_id: string;

  @Column({ nullable: true })
  arn_id: string;

  @Column({ nullable: true })
  sub_broker_id: string;

  @Column()
  bank_name: string;

  @Column()
  account_number: string;

  @Column()
  account_holder_name: string;

  @Column()
  ifsc_code: string;

  @Column({ nullable: true })
  upi_id: string;

  @Column({ default: false })
  is_primary: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
