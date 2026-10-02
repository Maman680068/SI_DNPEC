import 'reflect-metadata';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { optionsCors } from './common/cors';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  // Revue de sécurité 2026-10 : sans secret de signature (ou avec un secret trop court), aucun jeton
  // ne serait sûr — l'API refuse de démarrer plutôt que de tourner ainsi.
  if ((process.env.JWT_ACCESS_SECRET ?? '').length < 16) {
    throw new Error('JWT_ACCESS_SECRET manquant ou trop court (16 caractères au moins) : démarrage refusé.');
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
    console.warn('[sécurité] CORS_ORIGIN est vide en production : toutes les origines sont acceptées.');
  }
  if (process.env.NODE_ENV === 'production' && !process.env.WEB_PROXY_SECRET) {
    console.warn('[sécurité] WEB_PROXY_SECRET est vide : le verrouillage par adresse IP des connexions relayées par le web est désactivé (le verrouillage par compte reste actif).');
  }

  // Nécessaire derrière le reverse proxy de Render pour que req.ip reflète
  // l'IP réelle du client (X-Forwarded-For) — utilisé par le verrouillage
  // de compte/IP de LoginAttemptService.
  app.set('trust proxy', 1);

  app.use(helmet());
  // CORS_ORIGIN : liste d'origines autorisées séparées par des virgules (ex.
  // https://dnpec-web.onrender.com), normalisée (barre finale, espaces, casse) ;
  // chaque origine refusée est journalisée (common/cors.ts). Sans cette
  // variable, on reste permissif — les appels directs du navigateur à l'API
  // n'utilisent que l'en-tête Authorization, jamais de cookie (voir
  // apps/web/lib/api/client.ts), donc aucune donnée de session n'est exposée.
  app.enableCors(optionsCors(process.env.CORS_ORIGIN));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(
    // Journalise aussi tout 403 dans acces_refuses (socle NIMBA, §5.5).
    new HttpExceptionFilter(app.get(PrismaService)),
    // P2002 (unicité) → 409 ; toute autre erreur Prisma reste au comportement
    // par défaut de Nest (voir PrismaExceptionFilter).
    new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter),
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap();
