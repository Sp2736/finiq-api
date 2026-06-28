import { IsString, IsObject, IsNotEmpty } from 'class-validator';

export class CreateThemeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  @IsNotEmpty()
  variables: Record<string, string>;
}
