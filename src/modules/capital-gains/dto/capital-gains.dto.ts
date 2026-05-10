import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class CapitalGainsQueryDto {
    @IsNotEmpty()
    @IsString()
    investor_id: string;

    @IsNotEmpty()
    @IsDateString()
    from_date: string;

    @IsNotEmpty()
    @IsDateString()
    to_date: string;
}
