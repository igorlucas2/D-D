import { IsString } from 'class-validator';

export class TravelDto {
  @IsString()
  hotspotId!: string;
}
