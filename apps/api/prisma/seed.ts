import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cellules officielles de la DNPEC (§2.1 du cahier des charges) :
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

async function main() {
  for (const cellule of CELLULES) {
    await prisma.cellule.upsert({
      where: { code: cellule.code },
      update: { name: cellule.name },
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
