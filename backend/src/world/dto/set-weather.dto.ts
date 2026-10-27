import { IsIn } from 'class-validator';
import { WEATHERS, type Weather } from '../world.types';

export class SetWeatherDto {
  @IsIn(WEATHERS)
  weather: Weather;
}
