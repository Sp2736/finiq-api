import { IsString, IsObject, IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateThemeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @IsNotEmpty()
  variables: Record<string, string>;
}
