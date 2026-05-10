import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('otp_logs')
export class OtpLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    phone_number: string;

    @Column({
        type: 'enum',
        enum: ['USER', 'INVESTOR'],
        default: 'USER'
    })
    scope: 'USER' | 'INVESTOR';

    @Column()
    otp_code: string;

    @Column({ type: 'timestamp' })
    expires_at: Date;

    @Column({ default: false })
    is_used: boolean;

    @CreateDateColumn()
    created_at: Date;
}
