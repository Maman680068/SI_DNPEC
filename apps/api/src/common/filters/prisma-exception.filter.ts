import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Traduit la violation de contrainte d'unicité Prisma (P2002) en 409, avec un
 * message générique en français — jamais le nom de la contrainte ni du champ
 * (détail technique non exposé au client). Filet de sécurité : un service qui
 * connaît le sens métier du conflit (ex. décision déjà convertie) doit capter
 * P2002 lui-même et lever sa propre ConflictException, plus parlante.
 *
 * Toute autre erreur Prisma est rendue à BaseExceptionFilter, donc exactement
 * au comportement par défaut de Nest (500 « Internal server error » + log) —
 * rien d'autre ne change.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    if (exception.code !== 'P2002') {
      return super.catch(exception, host);
    }
    const response = host.switchToHttp().getResponse<Response>();
    response.status(HttpStatus.CONFLICT).json({
      statusCode: HttpStatus.CONFLICT,
      message: 'Cet enregistrement existe déjà (conflit d’unicité).',
      error: 'Conflict',
    });
  }
}
