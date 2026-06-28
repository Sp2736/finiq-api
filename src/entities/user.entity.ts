import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  BLOCKED = 'BLOCKED',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  phone_number: string;

  @Column()
  is_verified: boolean;

  // todo: fix this part to type-check
  // @Column({ nullable: true })
  // company_id: string;
  company_id?: string = '9d034353-d658-4fa5-b5a1-e46253cdbc0c';

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @Column({ type: 'timestamp with time zone', nullable: true })
  last_login: Date;

  @Column({ type: 'varchar', nullable: true, select: false })
  refresh_token: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  refresh_token_expires_at: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
