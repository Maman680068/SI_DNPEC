import { Module } from '@nestjs/common';
import { ProfilController } from './profil.controller';
import { ProfilService } from './profil.service';

@Module({ controllers: [ProfilController], providers: [ProfilService] })
export class ProfilModule {}
