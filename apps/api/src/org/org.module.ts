import { Module } from '@nestjs/common';
import { DivisionsController } from './divisions/divisions.controller';
import { DivisionsService } from './divisions/divisions.service';
import { SectionsController } from './sections/sections.controller';
import { SectionsService } from './sections/sections.service';
import { CellulesController } from './cellules/cellules.controller';
import { CellulesService } from './cellules/cellules.service';
import { CascadeService } from './cascade/cascade.service';

@Module({
  controllers: [DivisionsController, SectionsController, CellulesController],
  providers: [DivisionsService, SectionsService, CellulesService, CascadeService],
  exports: [CascadeService],
})
export class OrgModule {}
