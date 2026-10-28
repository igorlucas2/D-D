import { IsIn, IsString, MaxLength } from 'class-validator';

export class ParticipantDefenseDto {
  @IsString()
  @MaxLength(30)
  damageType!: string;

  @IsIn(['RESISTANCE', 'IMMUNITY', 'VULNERABILITY'])
  type!: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY';
}
