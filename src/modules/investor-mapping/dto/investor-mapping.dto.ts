import { IsNotEmpty, IsArray, IsUUID, IsEnum } from 'class-validator';

export class AssignInvestorsDto {
    @IsArray()
    @IsUUID('4', { each: true })
    @IsNotEmpty()
    investor_ids: string[];

    @IsUUID()
    @IsNotEmpty()
    sub_broker_id: string; // The broker/sub-broker node to assign to
}

export class UnassignInvestorsDto {
    @IsArray()
    @IsUUID('4', { each: true })
    @IsNotEmpty()
    investor_ids: string[];

    @IsUUID()
    @IsNotEmpty()
    sub_broker_id: string;
}
