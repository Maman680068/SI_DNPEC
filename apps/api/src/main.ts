import 'reflect-metadata';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { optionsCors } from './common/cors';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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
    new HttpExceptionFilter(),
    // P2002 (unicité) → 409 ; toute autre erreur Prisma reste au comportement
    // par défaut de Nest (voir PrismaExceptionFilter).
    new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter),
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap();
