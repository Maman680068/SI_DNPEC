/**
 * Vérification commune aux scripts lancés sur la production (paramétrage, démonstration) :
 * toutes les migrations du dépôt doivent être appliquées, sans échec en cours.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

export async function verifierMigrations(prisma: PrismaClient): Promise<void> {
  const dossier = path.join(__dirname, 'migrations');
  const attendues = fs.readdirSync(dossier).filter((d) => fs.statSync(path.join(dossier, d)).isDirectory());
  let appliquees: { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[];
  try {
    appliquees = await prisma.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`;
  } catch {
    throw new Error('Base sans historique de migrations : lancez d’abord db-migrate.yml.');
  }
  const ok = new Set(appliquees.filter((m) => m.finished_at && !m.rolled_back_at).map((m) => m.migration_name));
  const manquantes = attendues.filter((m) => !ok.has(m));
  const enEchec = appliquees.filter((m) => !m.finished_at && !m.rolled_back_at);
  if (manquantes.length || enEchec.length) {
    throw new Error(
      `Migrations non à jour — lancez d’abord db-migrate.yml.${manquantes.length ? ` Manquantes : ${manquantes.join(', ')}.` : ''}${
        enEchec.length ? ` En échec : ${enEchec.map((m) => m.migration_name).join(', ')}.` : ''
      }`,
    );
  }
  console.log(`Migrations à jour (${attendues.length}).`);
}

