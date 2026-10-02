import { typeServi } from '../common/storage/type-servi';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { StreamableFile } from '@nestjs/common';

// Même plafond que la GED (documents.controller.ts) : 25 Mo par fichier.
export const OPTIONS_FICHIERS = { storage: memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } };
export const MAX_FICHIERS = 10;

export function envoyerFichier(
  res: Response,
  f: { piece: { mimeType: string; fileName: string }; stream: NodeJS.ReadableStream },
): StreamableFile {
  res.set({
    'Content-Type': typeServi(f.piece.mimeType),
    'Content-Disposition': `attachment; filename="${encodeURIComponent(f.piece.fileName)}"`,
  });
  return new StreamableFile(f.stream as never);
}

export function envoyerExcel(res: Response, buffer: Buffer, nom: string): StreamableFile {
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${nom}_${new Date().toISOString().slice(0, 10)}.xlsx"`,
  });
  return new StreamableFile(buffer);
}
