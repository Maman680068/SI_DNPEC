// Z — démonstration sur une base neuve SANS aucun compte réel (paramétrage seul) : aucun DN ni DNA
// réel → un DN de démonstration est créé pour la vue Direction ; il voit la démonstration, le congé
// maladie y est masqué ; « supprimer » le passe en SUPPRIME (le poste de DN redevient libre).
const { check, bilan } = require('../lib');
const D = require('../demo_outils');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();

(async () => {
  check('base sans DN ni DNA actif', (await prisma.user.count({ where: { role: { in: ['DN', 'DNA'] }, status: 'ACTIF' } })) === 0);
  const r = D.lancerDemo('creer');
  check('création sans erreur', r.code === 0 && !/ÉCHEC/.test(r.sortie), r.sortie.slice(-500));
  check('journal : DN de démonstration annoncé', r.sortie.includes(`Vue Direction : aucun DN/DNA réel actif — DN de démonstration ${D.email('dn')}`));
  const dn = await prisma.user.findUnique({ where: { email: D.email('dn') } });
  check('DN de démonstration actif', dn?.role === 'DN' && dn.status === 'ACTIF' && dn.firstName.startsWith('TEST — '));
  const s = await D.connexion(D.email('dn'));
  check('connexion du DN de démonstration', s.status === 200);
  const taches = await D.appel(s.token, 'GET', '/tasks');
  check(`le DN voit les tâches de la démonstration (${Array.isArray(taches.body) ? taches.body.length : '?'})`, taches.status === 200 && taches.body.filter((t) => t.title.startsWith('TEST — ')).length >= 25);
  const conges = await D.appel(s.token, 'GET', '/leaves');
  const maladie = Array.isArray(conges.body) && conges.body.find((c) => c.user && c.user.lastName === 'Touré');
  check('congé maladie masqué pour la Direction', !!maladie && /motif protégé/.test(JSON.stringify(maladie.leaveType)) && !JSON.stringify(maladie).includes('CONGE_MALADIE'), JSON.stringify(maladie && maladie.leaveType));
  const r2 = D.lancerDemo('supprimer');
  check('suppression sans erreur', r2.code === 0 && !/ÉCHEC/.test(r2.sortie));
  check('DN de démonstration en SUPPRIME : le poste de DN redevient libre', (await prisma.user.findUnique({ where: { email: D.email('dn') } })).status === 'SUPPRIME' && (await prisma.user.count({ where: { role: 'DN', status: 'ACTIF' } })) === 0);
  await prisma.$disconnect();
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
