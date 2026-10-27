import { IsUUID } from 'class-validator';

export class DeathSaveDto {
  @IsUUID()
  requestKey: string;
}
