import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import * as path from 'path';
import { cheminIntegre, estIntegre } from './fichiers-integres';

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
  /** Dossier du stockage (supervision de l'espace disque, sauvegarde des fichiers). */
  readonly root = process.env.DOCUMENTS_STORAGE_PATH || path.join(process.cwd(), 'storage', 'documents');

  async save(buffer: Buffer, originalName: string): Promise<{ fileKey: string; sizeBytes: number }> {
    await mkdir(this.root, { recursive: true });
    const fileKey = `${randomUUID()}${path.extname(originalName)}`;
    await writeFile(path.join(this.root, fileKey), buffer);
    return { fileKey, sizeBytes: buffer.length };
  }

  /**
   * Dépose le fichier, puis exécute `persist` (l'écriture en base qui le
   * référence : create, upsert ou transaction). Si `persist` échoue, le
   * fichier déposé est supprimé (compensation) avant de relancer l'erreur
   * d'origine — jamais de fichier orphelin sur le disque sans ligne en base.
   * L'échec éventuel de la suppression elle-même n'écrase jamais l'erreur
   * d'origine (c'est elle que l'appelant doit voir).
   */
  async saveThen<T>(
    buffer: Buffer,
    originalName: string,
    persist: (saved: { fileKey: string; sizeBytes: number }) => Promise<T>,
  ): Promise<T> {
    const saved = await this.save(buffer, originalName);
    try {
      return await persist(saved);
    } catch (error) {
      await this.delete(saved.fileKey).catch(() => undefined);
      throw error;
    }
  }

  /** Variante de saveThen pour plusieurs fichiers déposés ensemble (ex. scans
   * d'un courrier) : tous sont supprimés si l'écriture en base échoue. */
  async saveAllThen<T>(
    files: { buffer: Buffer; originalName: string }[],
    persist: (saved: { fileKey: string; sizeBytes: number }[]) => Promise<T>,
  ): Promise<T> {
    const saved: { fileKey: string; sizeBytes: number }[] = [];
    try {
      for (const f of files) saved.push(await this.save(f.buffer, f.originalName));
      return await persist(saved);
    } catch (error) {
      await Promise.all(saved.map((s) => this.delete(s.fileKey).catch(() => undefined)));
      throw error;
    }
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
    if (estIntegre(fileKey)) return; // fichier livré avec l'application : jamais supprimé
    const filePath = this.resolvePath(fileKey);
    if (existsSync(filePath)) await unlink(filePath);
  }

  private resolvePath(fileKey: string): string {
    if (estIntegre(fileKey)) return cheminIntegre(fileKey);
    // path.basename empêche toute traversée de répertoire (fileKey vient de la
    // base — généré par cette classe — mais jamais fait confiance sans vérification).
    return path.join(this.root, path.basename(fileKey));
  }
}
