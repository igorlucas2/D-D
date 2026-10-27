import { IsIn } from 'class-validator';

export class RestDto {
  @IsIn(['short', 'long'])
  type!: 'short' | 'long';
}
