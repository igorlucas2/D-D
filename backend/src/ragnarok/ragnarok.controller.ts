import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RagnarokService } from './ragnarok.service';

@UseGuards(JwtAuthGuard)
@Controller('ragnarok')
export class RagnarokController {
  constructor(private readonly ragnarokService: RagnarokService) {}

  @Get('summary')
  summary() {
    return this.ragnarokService.summary();
  }

  @Get('classes')
  classes(@Query('search') search?: string) {
    return this.ragnarokService.listJobs(search);
  }

  @Get('skills')
  skills(
    @Query('search') search?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.ragnarokService.listSkills(search, take, skip);
  }

  @Get('items')
  items(
    @Query('search') search?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('costume') costume?: string,
  ) {
    return this.ragnarokService.listItems(search, take, skip, costume);
  }

  @Get('maps')
  maps(@Query('search') search?: string) {
    return this.ragnarokService.listMaps(search);
  }
}
