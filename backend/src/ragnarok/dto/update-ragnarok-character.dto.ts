import { PartialType } from '@nestjs/mapped-types';
import { CreateRagnarokCharacterDto } from './create-ragnarok-character.dto';

export class UpdateRagnarokCharacterDto extends PartialType(
  CreateRagnarokCharacterDto,
) {}
