// Rapport de qualité des données (formation et démarrage réel, octobre 2026) : le script
// apps/api/prisma/qualite-donnees.ts, lancé comme par le workflow db-qualite.yml, donne des chiffres
// exacts, n'écrit rien en base, et ne contient aucun nom ni adresse avec --sans-noms.
const { execFileSync } = require('child_process');
const path = require('path');
const E = require('../config');
const { check, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();

const lancer = (...args) => execFileSync('pnpm', ['--silent', '--filter', '@dnpec/api', 'run', 'db:qualite', '--', ...args], { cwd: E.RACINE, encoding: 'utf8', env: process.env });
const nombre = (md, titre) => { const l = md.split('\n').find((x) => x.startsWith(`| ${titre}`)); return l ? Number(/\*\*(\d+)\*\*/.exec(l)[1]) : null; };

(async () => {
  // Un agent sans unité et un matricule provisoire, pour des rubriques non vides.
  const S = Date.now().toString(36).slice(-5);
  await prisma.agent.create({ data: { matricule: `Q-${S}`, matriculeProvisoire: true, nom: `Qualite${S}`, prenoms: 'Test', uniteId: null } });
  const empreinte = async () => Promise.all([prisma.agent.count(), prisma.user.count(), prisma.auditLog.count(), prisma.parametre.count(), prisma.notification.count()]);
  const avant = await empreinte();
  const complet = lancer();
  const chiffres = lancer('--sans-noms');
  const apres = await empreinte();
  check('rapport produit : 11 rubriques avec leur action', (complet.match(/^\| [^|]+ \| \*\*\d+\*\* \|/gm) || []).length === 11, complet.slice(0, 300));
  check('aucune écriture en base (transaction en lecture seule)', JSON.stringify(avant) === JSON.stringify(apres), `${avant} / ${apres}`);
  const sansUnite = await prisma.agent.count({ where: { statut: { not: 'PARTI' }, uniteId: null } });
  const provisoires = await prisma.agent.count({ where: { statut: { not: 'PARTI' }, matriculeProvisoire: true } });
  check('agents sans unité : chiffre exact', nombre(complet, 'Agents sans unité') === sansUnite, `${nombre(complet, 'Agents sans unité')} / ${sansUnite}`);
  check('matricules provisoires : chiffre exact, l’agent créé est nommé', nombre(complet, 'Matricules provisoires') === provisoires && complet.includes(`Test Qualite${S}`));
  check('familles d’actes RH sans registre : chiffre exact', nombre(complet, 'Familles d’actes RH sans registre') === (await prisma.familleActeRh.count({ where: { registreId: null } })));
  check('--sans-noms (workflow) : mêmes chiffres, aucun nom ni adresse email', nombre(chiffres, 'Agents sans unité') === sansUnite && !chiffres.includes(`Qualite${S}`) && !/@/.test(chiffres));
  await prisma.agent.deleteMany({ where: { matricule: `Q-${S}` } });
  await prisma.$disconnect();
  bilan();
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
