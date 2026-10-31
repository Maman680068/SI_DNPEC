// S9c — paramétrage du courrier en une lecture (GET /courrier/parametrage, administrateur) : alertes (registre
// actif sans personne habilitée active ; famille d'actes RH sans registre, avec le lien vers Carrière et
// actes), registres groupés par nature (Arrivée, Départ, Actes) avec le prochain numéro lu SANS consommer la
// séquence, les numéros de l'année et la date du dernier, les personnes habilitées (compte inactif signalé),
// la famille d'actes liée (« à corriger ») ; habilitations groupées par registre ; registres de démonstration
// repérés. Droits inchangés : tout autre profil 403 ; aucun contenu de courrier.
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const S = Date.now().toString(36).slice(-4).toUpperCase();
const URL = '/courrier/parametrage';
const an = new Date().getFullYear();
const vue = async () => (await call('admin', 'GET', URL)).body;
const ligne = (v, id) => v.groupes.flatMap((g) => g.registres).find((r) => r.id === id);

(async () => {
  console.log('— Droits');
  for (const k of ['dn', 'dna', 'drh', 'agent1', 'chefdpe']) expect(`${k} : refusé`, await call(k, 'GET', URL), 403);
  const v0 = await call('admin', 'GET', URL);
  expect('administrateur : vue lue', v0, 200);
  check('trois groupes dans l’ordre Arrivée, Départ, Actes', v0.body.groupes.map((g) => g.libelle).join() === 'Arrivée,Départ,Actes');
  check('chaque registre dans le groupe de sa nature', v0.body.groupes.every((g) => g.registres.every((r) => r.nature === g.nature)));
  check('aucun contenu de courrier dans la réponse', !/expediteur|objet"|analyse/.test(JSON.stringify(v0.body)));

  console.log('— Registre actif sans personne habilitée');
  const code = `S9C${S}`;
  const r = (await call('admin', 'POST', '/courrier/registres', { code, libelle: 'Registre S9c', nature: 'DEPART', portee: 'DIRECTION', gabaritNumero: '{seq:3}-{code}/{annee}' })).body;
  let v = await vue();
  check('alerte : le registre neuf, sans personne', v.alertes.registresSansPersonne.some((x) => x.id === r.id) && ligne(v, r.id).sansPersonne && ligne(v, r.id).habilites.length === 0);
  check('prochain numéro (aperçu) : 001-CODE/année ; aucun numéro cette année', ligne(v, r.id).prochainNumero === `001-${code}/${an}` && ligne(v, r.id).utilisesAnnee === 0 && ligne(v, r.id).dernierLe === null, JSON.stringify(ligne(v, r.id)));
  check('portée « Direction », gabarit rendu', ligne(v, r.id).porteeLibelle === 'Direction' && ligne(v, r.id).gabarit === '{seq:3}-{code}/{annee}');
  const h = await call('admin', 'POST', '/courrier/habilitations', { userId: ids.agent2, registreId: r.id });
  expect('habilitation accordée à agent2', h, 201);
  v = await vue();
  const a2 = await prisma.user.findUnique({ where: { id: ids.agent2 } });
  check('alerte levée ; agent2 parmi les personnes habilitées', !v.alertes.registresSansPersonne.some((x) => x.id === r.id) && ligne(v, r.id).habilites.some((x) => x.nom === `${a2.firstName} ${a2.lastName}` && x.actif));
  const g = v.habilitations.find((x) => x.registre.id === r.id);
  check('habilitations groupées par registre (agent2, unité Direction)', g && g.actives.length === 1 && g.actives[0].compteActif && /DNPEC/.test(g.actives[0].unite));

  console.log('— Compte inactif signalé');
  const avantInactifs = v.comptesInactifsHabilites;
  await prisma.user.update({ where: { id: ids.agent2 }, data: { status: 'SUSPENDU' } });
  v = await vue();
  check('agent2 suspendu : signalé, le registre revient en alerte', ligne(v, r.id).habilites[0].actif === false && v.alertes.registresSansPersonne.some((x) => x.id === r.id) && v.habilitations.find((x) => x.registre.id === r.id).actives[0].compteActif === false && v.comptesInactifsHabilites === avantInactifs + 1);
  await prisma.user.update({ where: { id: ids.agent2 }, data: { status: 'ACTIF' } });

  console.log('— Prochain numéro sans consommer la séquence ; numéros de l’année');
  expect('reprise du compteur à 41', await call('admin', 'POST', `/courrier/registres/${r.id}/compteurs/initialiser`, { annee: an, dernier: 41 }), 201);
  v = await vue();
  await vue();
  const c = await prisma.compteurRegistre.findUnique({ where: { registreId_uniteKey_annee: { registreId: r.id, uniteKey: 'DNPEC', annee: an } } });
  check('prochain : 042 ; 41 numéros cette année, date du dernier', ligne(v, r.id).prochainNumero === `042-${code}/${an}` && ligne(v, r.id).utilisesAnnee === 41 && !!ligne(v, r.id).dernierLe);
  check('deux lectures : le compteur reste à 41 (rien de consommé)', c.dernier === 41);

  console.log('— Familles d’actes RH');
  const fam = await prisma.familleActeRh.findFirst({ where: { registreId: { not: null } }, include: { registre: true } });
  if (fam) {
    const lie = ligne(v, fam.registreId);
    check(`registre ${fam.registre.code} : famille « ${fam.libelle} » liée`, lie && lie.familles.some((f) => f.code === fam.code));
    await prisma.familleActeRh.update({ where: { code: fam.code }, data: { registreId: null } });
    v = await vue();
    check('famille sans registre : alerte et lien vers Carrière et actes', v.alertes.famillesSansRegistre.some((f) => f.code === fam.code) && v.alertes.lienFamilles === '/rh?onglet=carriere');
    await prisma.familleActeRh.update({ where: { code: fam.code }, data: { registreId: fam.registreId } });
  }
  const mauvais = (await call('admin', 'POST', '/courrier/registres', { code: `X${S}A`, libelle: 'Actes S9c', nature: 'ACTE', portee: 'DIRECTION', gabaritNumero: '{seq}/{code}/{annee}' })).body;
  const autre = await prisma.familleActeRh.findFirst({ orderBy: { code: 'asc' } });
  await prisma.familleActeRh.update({ where: { code: autre.code }, data: { registreId: mauvais.id } });
  v = await vue();
  check(`registre au mauvais code : famille « ${autre.libelle} » à corriger`, ligne(v, mauvais.id).familles.some((f) => f.code === autre.code && f.etat === 'A_CORRIGER'));
  await prisma.familleActeRh.update({ where: { code: autre.code }, data: { registreId: autre.registreId } });

  console.log('— Démonstration');
  const demo = (await call('admin', 'POST', '/courrier/registres', { code: `TEST-S9${S}`, libelle: 'TEST — Registre', nature: 'ARRIVEE', portee: 'DIRECTION', gabaritNumero: '{seq}/{annee}' })).body;
  v = await vue();
  check('registre TEST-… marqué « démonstration » (registres et alertes)', ligne(v, demo.id).demonstration && v.alertes.registresSansPersonne.find((x) => x.id === demo.id).demonstration && !ligne(v, r.id).demonstration);
  for (const x of [r, mauvais, demo]) await call('admin', 'PATCH', `/courrier/registres/${x.id}`, { isActive: false });
  await call('admin', 'POST', `/courrier/habilitations/${h.body.id}/revoquer`);
  v = await vue();
  check('registre désactivé : plus en alerte ; habilitation révoquée dans l’historique', !v.alertes.registresSansPersonne.some((x) => x.id === r.id) && v.habilitations.find((x) => x.registre.id === r.id).historique.length === 1);

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
