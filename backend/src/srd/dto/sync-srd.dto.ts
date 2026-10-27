import { IsArray, IsOptional, IsString } from 'class-validator';

export class SyncSrdDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  endpoints?: string[];
}
