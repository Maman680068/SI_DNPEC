import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import * as path from 'path';

/**
 * Stockage des fichiers de la GED (RF-GED-01/02/03). Implémentation disque local —
 * PAS MinIO/S3 comme prévu au cahier des charges (§7.7), faute d'infrastructure
 * objet provisionnée à ce stade.
 *
 * ATTENTION avant mise en production : le système de fichiers d'un Web Service
 * Render standard est éphémère (effacé à chaque redéploiement). Deux options,
 * toutes deux déjà compatibles avec cette classe sans changement de contrôleur :
 *   1. Provisionner un Render Persistent Disk et pointer DOCUMENTS_STORAGE_PATH
 *      dessus (variable d'environnement, voir ci-dessous) ;
 *   2. Remplacer cette classe par un client MinIO/S3 implémentant la même
 *      interface (save/read/delete) — StorageService est le seul point de contact,
 *      DocumentsService et FoldersService ne connaissent que fileKey.
 * Ne JAMAIS déployer tel quel sur un disque éphémère sans avoir tranché l'un des
 * deux points ci-dessus — les documents seraient perdus au premier redéploiement.
 */
@Injectable()
export class StorageService {
  private readonly root = process.env.DOCUMENTS_STORAGE_PATH || path.join(process.cwd(), 'storage', 'documents');

  async save(buffer: Buffer, originalName: string): Promise<{ fileKey: string; sizeBytes: number }> {
    await mkdir(this.root, { recursive: true });
    const fileKey = `${randomUUID()}${path.extname(originalName)}`;
    await writeFile(path.join(this.root, fileKey), buffer);
    return { fileKey, sizeBytes: buffer.length };
  }

  async readBuffer(fileKey: string): Promise<Buffer> {
    const filePath = this.resolvePath(fileKey);
    if (!existsSync(filePath)) throw new NotFoundException('Fichier introuvable sur le stockage');
    return readFile(filePath);
  }

  createReadStream(fileKey: string) {
    const filePath = this.resolvePath(fileKey);
    if (!existsSync(filePath)) throw new NotFoundException('Fichier introuvable sur le stockage');
    return createReadStream(filePath);
  }

  async delete(fileKey: string): Promise<void> {
    const filePath = this.resolvePath(fileKey);
    if (existsSync(filePath)) await unlink(filePath);
  }

  private resolvePath(fileKey: string): string {
    // path.basename empêche toute traversée de répertoire (fileKey vient de la
    // base — généré par cette classe — mais jamais fait confiance sans vérification).
    return path.join(this.root, path.basename(fileKey));
  }
}
