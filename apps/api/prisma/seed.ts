import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cellules officielles de la DNPEC (§2 du cahier des charges) :
// CTSCM et CNC rattachées au DN, SAF/RH/CSID rattachées à la DNA.
const CELLULES = [
  {
    code: 'CTSCM',
    name: 'Cellule Technique de Suivi de la Conjoncture Macroéconomique',
  },
  {
    code: 'CNC',
    name: 'Comité National de Coordination des Politiques Macroéconomiques et Monétaires',
  },
  { code: 'SAF', name: 'Service Administratif et Financier' },
  { code: 'RH', name: 'Ressources Humaines' },
  { code: 'CSID', name: "Cellule des Systèmes d'Informations et de la Digitalisation" },
];

// Crée seulement les cellules manquantes. Une cellule déjà en base n'est JAMAIS
// modifiée (ni son identifiant ni son nom, qui a pu être changé dans
// Administration → Organisation) : ce seed est lancé à chaque db-migrate.yml.
async function main() {
  for (const cellule of CELLULES) {
    await prisma.cellule.upsert({
      where: { code: cellule.code },
      update: {},
      create: cellule,
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
