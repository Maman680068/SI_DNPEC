import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Nécessaire derrière le reverse proxy de Render pour que req.ip reflète
  // l'IP réelle du client (X-Forwarded-For) — utilisé par le verrouillage
  // de compte/IP de LoginAttemptService.
  app.set('trust proxy', 1);

  app.use(helmet());
  // CORS_ORIGIN : liste d'origines autorisées séparées par des virgules (ex.
  // https://dnpec-web.onrender.com). Sans cette variable (cas actuel, avant
  // le déploiement du frontend), on reste permissif — les appels directs du
  // navigateur à l'API n'utilisent que l'en-tête Authorization, jamais de
  // cookie (voir apps/web/lib/api/client.ts), donc aucune donnée de session
  // n'est exposée par cette permissivité temporaire.
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap();
