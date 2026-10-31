// S7 — familles d'actes et mouvements de carrière : jauge « N familles prêtes sur 6 », état par famille
// (prête / à corriger / bloquée), alerte de code (ex. ATT sur l'arrêté d'affectation), prochain numéro calculé
// sans consommer la séquence, « Lui donner ATT », « Configurer les registres manquants » (création au format
// {seq:4}/MEFB/DNPEC/{code}/{annee} et rattachement, audités) ; DN et DNA en lecture ; mouvements filtrés par
// année et type avec quatre compteurs.
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const URL = '/api/v1/rh/familles-actes';
const GABARIT = '{seq:4}/MEFB/DNPEC/{code}/{annee}';
const fam = (e, code) => e.familles.find((f) => f.code === code);

(async () => {
  console.log('— Situation de départ (comme en production : ATT sur l’arrêté d’affectation)');
  await prisma.familleActeRh.updateMany({ data: { registreId: null } });
  let att = await prisma.registreCourrier.findUnique({ where: { code: 'ATT' } });
  if (!att) att = (await call('admin', 'POST', '/courrier/registres', { code: 'ATT', libelle: 'Attestations', nature: 'ACTE', portee: 'DIRECTION', gabaritNumero: 'ATT/{seq}/{annee}' })).body;
  expect('ATT rattaché à « Arrêté d’affectation »', await call('drh', 'PATCH', `${URL}/ARRETE_AFFECTATION`, { registreId: att.id }), 200);

  console.log('— Lecture et droits');
  expect('agent : refusé', await call('agent1', 'GET', URL), 403);
  const dn = (await call('dn', 'GET', URL)).body;
  check('DN : lecture seule (aucune action, aucune configuration)', dn.droits.gerer === false && dn.familles.every((f) => f.action === null) && dn.configuration.length === 0);
  expect('DN : action refusée', await call('dn', 'POST', `${URL}/ATTESTATION_TRAVAIL/registre-attendu`), 403);
  const e0 = (await call('drh', 'GET', URL)).body;
  check('jauge : 0 famille prête sur 6', e0.pretes === 0 && e0.total === 6);
  const aff = fam(e0, 'ARRETE_AFFECTATION');
  check('arrêté d’affectation : « à corriger », alerte ATT ≠ AFF, « Passer au registre AFF »', aff.etat === 'A_CORRIGER' && /ATT/.test(aff.alerte) && /AFF/.test(aff.alerte) && aff.action.libelle === 'Passer au registre AFF');
  const attT = fam(e0, 'ATTESTATION_TRAVAIL');
  check('attestation de travail : « bloquée », « Lui donner ATT »', attT.etat === 'BLOQUEE' && attT.action.libelle === 'Lui donner ATT' && /ni préparé ni signé/.test(attT.alerte));
  check('configuration proposée : les 6 familles', e0.configuration.length === 6);

  console.log('— Prochain numéro : aperçu sans consommer la séquence');
  const avant = await prisma.compteurRegistre.findMany({ where: { registreId: att.id } });
  const n1 = fam((await call('drh', 'GET', URL)).body, 'ARRETE_AFFECTATION').prochainNumero;
  const n2 = fam((await call('drh', 'GET', URL)).body, 'ARRETE_AFFECTATION').prochainNumero;
  const apres = await prisma.compteurRegistre.findMany({ where: { registreId: att.id } });
  check('même aperçu deux fois, compteur inchangé', !!n1 && n1 === n2 && JSON.stringify(avant) === JSON.stringify(apres), n1);

  console.log('— « Lui donner ATT », puis « Configurer les registres manquants »');
  const e1 = await call('drh', 'POST', `${URL}/ATTESTATION_TRAVAIL/registre-attendu`);
  expect('DRH : « Lui donner ATT »', e1, 200);
  check('ATT passe à l’attestation de travail (prête) ; l’arrêté d’affectation devient bloqué', fam(e1.body, 'ATTESTATION_TRAVAIL').etat === 'PRETE' && fam(e1.body, 'ARRETE_AFFECTATION').etat === 'BLOQUEE' && /AFF/.test(fam(e1.body, 'ARRETE_AFFECTATION').action.libelle));
  const conf = await call('admin', 'POST', `${URL}/configurer`);
  expect('administrateur : configurer les registres manquants', conf, 200);
  check('6 familles prêtes sur 6', conf.body.pretes === 6 && conf.body.configuration.length === 0);
  for (const code of ['AFF', 'NOM', 'AVA', 'FDC', 'ATS']) {
    const r = await prisma.registreCourrier.findUnique({ where: { code } });
    check(`registre ${code} : actes de la Direction, actif`, !!r && r.nature === 'ACTE' && r.portee === 'DIRECTION' && r.isActive);
  }
  const aff2 = fam(conf.body, 'ARRETE_AFFECTATION');
  const regAff = await prisma.registreCourrier.findUnique({ where: { code: 'AFF' } });
  if (regAff.gabaritNumero === GABARIT) check('prochain numéro de l’arrêté d’affectation au format …/MEFB/DNPEC/AFF/année', /^\d{4}\/MEFB\/DNPEC\/AFF\/\d{4}$/.test(aff2.prochainNumero), aff2.prochainNumero);
  check('création et rattachement audités', (await prisma.auditLog.count({ where: { entityType: 'FamilleActeRh', metadata: { path: ['event'], equals: 'registre_attendu' } } })) >= 6);

  console.log('— Mouvements de carrière : filtres et compteurs');
  const m = (await call('drh', 'GET', '/api/v1/rh/mouvements')).body;
  check('quatre compteurs calculés par l’API', ['enPreparation', 'enAttenteSignature', 'appliques', 'annules'].every((k) => Number.isInteger(m.compteurs[k])) && m.types.length === 5);
  const vide = (await call('drh', 'GET', '/api/v1/rh/mouvements?annee=2099')).body;
  check('filtre année sans mouvement : liste et compteurs vides', vide.mouvements.length === 0 && Object.values(vide.compteurs).every((v) => v === 0));
  const t = (await call('drh', 'GET', '/api/v1/rh/mouvements?type=MUTATION')).body;
  check('filtre type : mutations seulement', t.mouvements.every((x) => x.type === 'MUTATION'));
  check('« Préparer un mouvement » : DRH seulement', m.droits.preparer === true && (await call('dn', 'GET', '/api/v1/rh/mouvements')).body.droits.preparer === false);
  void ids;
  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
