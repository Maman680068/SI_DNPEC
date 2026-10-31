import { Module } from '@nestjs/common';
import { DivisionsController } from './divisions/divisions.controller';
import { DivisionsService } from './divisions/divisions.service';
import { SectionsController } from './sections/sections.controller';
import { SectionsService } from './sections/sections.service';
import { CellulesController } from './cellules/cellules.controller';
import { CellulesService } from './cellules/cellules.service';
import { CascadeService } from './cascade/cascade.service';
import { OrganisationVueController } from './organisation-vue.controller';
import { OrganisationVueService } from './organisation-vue.service';

@Module({
  controllers: [DivisionsController, SectionsController, CellulesController, OrganisationVueController],
  providers: [DivisionsService, SectionsService, CellulesService, CascadeService, OrganisationVueService],
  exports: [CascadeService],
})
export class OrgModule {}
