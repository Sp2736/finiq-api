import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import type { CompanyArn } from './company-arn.entity';

export enum ErrorType {
    PASSWORD_NOT_FOUND = 'PASSWORD_NOT_FOUND',
    PASSWORD_INCORRECT = 'PASSWORD_INCORRECT',
    ZIP_EXTRACTION_FAILED = 'ZIP_EXTRACTION_FAILED',
    EXCEL_PARSING_FAILED = 'EXCEL_PARSING_FAILED',
    DATABASE_INSERTION_FAILED = 'DATABASE_INSERTION_FAILED',
    EMAIL_VALIDATION_FAILED = 'EMAIL_VALIDATION_FAILED',
    FILE_PROCESSING_FAILED = 'FILE_PROCESSING_FAILED',
    ARN_NOT_FOUND = 'ARN_NOT_FOUND',
    NO_ATTACHMENTS = 'NO_ATTACHMENTS',
    INVALID_FILE_FORMAT = 'INVALID_FILE_FORMAT',
    OTHER = 'OTHER',
}

@Entity('email_processing_errors')
export class EmailProcessingError {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    company_arn_id: string;

    @ManyToOne('CompanyArn', { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'company_arn_id' })
    company_arn: CompanyArn;

    @Column({
        type: 'enum',
        enum: ErrorType,
        default: ErrorType.OTHER,
    })
    error_type: ErrorType;

    @Column({ type: 'text' })
    error_message: string;

    @Column({ type: 'text', nullable: true })
    error_stack: string;

    @Column({ nullable: true })
    email_message_id: string;

    @Column({ nullable: true })
    email_subject: string;

    @Column({ nullable: true })
    email_from: string;

    @Column({ nullable: true })
    file_name: string;

    @Column({ nullable: true })
    file_path: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata: {
        request_id?: string;
        arn_no?: string;
        source?: string;
        attachment_count?: number;
        [key: string]: any;
    };

    @Column({ default: false })
    is_resolved: boolean;

    @Column({ type: 'text', nullable: true })
    resolution_notes: string | null;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;

    @Column({ type: 'timestamp with time zone', nullable: true })
    resolved_at: Date;
}
