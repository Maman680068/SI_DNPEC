// Nomination d'un chef (option A) — l'acte de nomination signé à un poste de responsabilité crée un
// changement de rôle pré-rempli « en attente » (nouveau rôle, nouvelle unité, effet sur l'actuel
// titulaire), notifié à l'administrateur, qui le confirme ou le refuse avec un motif ; le DRH voit
// « droits appliqués / en attente / refusés » ; écarts fonction du dossier / rôle du compte signalés
// chaque jour et dans la supervision. Cas 400, 403 et 409. Comptes et unités propres à la suite,
// suspendus à la fin (aucun écart laissé aux suites suivantes).
const E = require('../config');
const { call, ids, login, check, expect, bilan } = require('../lib');
const { NestFactory } = require('@nestjs/core');
const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const API = 'http://localhost:3000';
const D = E.API_DIST;
const S = Date.now().toString(36).slice(-5);
const L = S.toUpperCase().replace(/\d/g, (x) => 'ABCDEFGHIJ'[x]);
const jour = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

async function signerActe(acteId) {
  expect('soumission de l’acte', await call('drh', 'POST', `/courrier/actes/${acteId}/soumettre`), 201);
  let a = await prisma.acteCourrier.findUnique({ where: { id: acteId } });
  for (let i = 0; a.statut === 'EN_VISA' && i < 4; i++) {
    const visa = await prisma.visaActe.findFirst({ where: { acteId, statut: 'EN_ATTENTE' } });
    const viseur = Object.entries(ids).find(([, v]) => v === (visa && visa.viseurAttenduId));
    if (!viseur) break;
    await call(viseur[0], 'POST', `/courrier/actes/${acteId}/viser`, {});
    a = await prisma.acteCourrier.findUnique({ where: { id: acteId } });
  }
  const fd = new FormData(); fd.append('file', new Blob([`SCAN ${S}`]), 'signe.pdf');
  const r = await fetch(`${API}/courrier/actes/${acteId}/signer`, { method: 'POST', headers: { Authorization: 'Bearer ' + (await login('dn')) }, body: fd });
  check('le DN signe l’acte (numéro attribué)', r.status === 201, r.status);
  return prisma.acteCourrier.findUnique({ where: { id: acteId } });
}

/** Nomination préparée par le DRH puis portée par un acte signé ; renvoie le mouvement. */
async function nommer(userId, apres) {
  const mv = await call('drh', 'POST', '/api/v1/rh/mouvements', { userId, type: 'NOMINATION', dateEffet: jour(0), apres });
  expect(`le DRH prépare la nomination (${apres.fonction})`, mv, 201);
  const ac = await call('drh', 'POST', `/api/v1/rh/mouvements/${mv.body.id}/acte`);
  expect('… acte préparé', ac, 201);
  const acte = await signerActe(ac.body.acteId);
  return { ...mv.body, acte };
}
const changementDe = (mouvementId) => prisma.changementRoleNomination.findUnique({ where: { mouvementId } });
const compte = (id) => prisma.user.findUnique({ where: { id }, select: { role: true, divisionId: true, sectionId: true, celluleId: true, jobTitle: true, agent: { select: { fonction: true } } } });
const ligneDe = async (id) => (await call('admin', 'GET', '/api/v1/changements-role')).body.changements.find((c) => c.id === id);
const notifAdmin = (depuis, re) => prisma.notification.count({ where: { userId: ids.admin, channel: 'IN_APP', createdAt: { gte: depuis }, title: { contains: re } } });

(async () => {
  const app = await NestFactory.createApplicationContext(require(D + '/app.module').AppModule, { logger: false });
  const nominations = app.get(require(D + '/role-change/nominations-role.service').NominationsRoleService);
  const roles = app.get(require(D + '/role-change/role-change.service').RoleChangeService);

  // Unités et comptes propres à la suite.
  const hash = await argon2.hash('Password123!', { type: argon2.argon2id });
  const div = await prisma.division.create({ data: { code: `NR${L}`, name: `Division nominations ${S}` } });
  const sec = await prisma.section.create({ data: { divisionId: div.id, code: `NS${L}`, name: `Section nominations ${S}` } });
  const cree = async (cle, role, extra) => (await prisma.user.create({ data: { email: `${cle}@test.local`, passwordHash: hash, firstName: cle.toUpperCase(), lastName: 'Nomination', role, status: 'ACTIF', ...extra } })).id;
  const K = { chef: `nrchef${S}`, a: `nra${S}`, b: `nrb${S}` };
  const chef = await cree(K.chef, 'CHEF_SECTION', { divisionId: div.id, sectionId: sec.id });
  const a = await cree(K.a, 'AGENT', { divisionId: div.id, sectionId: sec.id });
  const b = await cree(K.b, 'AGENT', { divisionId: div.id });
  const familleAvant = await prisma.familleActeRh.findUnique({ where: { code: 'DECISION_NOMINATION' } });
  const reg = (await call('admin', 'POST', '/courrier/registres', { code: `DNR${L}`, libelle: `Décisions de nomination ${S}`, nature: 'ACTE', portee: 'DIRECTION', gabaritNumero: `DNR${L}/{seq:3}/{annee}` })).body;
  expect('registre de la famille « nomination »', await call('drh', 'PATCH', '/api/v1/rh/familles-actes/DECISION_NOMINATION', { registreId: reg.id }), 200);

  try {
    console.log('— Préparation par le DRH : poste de responsabilité facultatif, contrôlé');
    expect('poste qui n’est pas de responsabilité (Chargé d’Études)', await call('drh', 'POST', '/api/v1/rh/mouvements', { userId: a, type: 'NOMINATION', dateEffet: jour(0), apres: { fonction: 'Chargé d’études', role: 'AGENT', divisionId: div.id } }), 400);
    expect('Chef de Section sans section', await call('drh', 'POST', '/api/v1/rh/mouvements', { userId: a, type: 'NOMINATION', dateEffet: jour(0), apres: { fonction: 'Chef de section', role: 'CHEF_SECTION', divisionId: div.id } }), 400);
    expect('section hors de la division', await call('drh', 'POST', '/api/v1/rh/mouvements', { userId: a, type: 'NOMINATION', dateEffet: jour(0), apres: { fonction: 'Chef de section', role: 'CHEF_SECTION', divisionId: ids.DEE, sectionId: sec.id } }), 400);
    expect('un agent prépare une nomination', await call('agent1', 'POST', '/api/v1/rh/mouvements', { userId: a, type: 'NOMINATION', dateEffet: jour(0), apres: { fonction: 'Chef de section', role: 'CHEF_SECTION', divisionId: div.id, sectionId: sec.id } }), 403);

    console.log('— Poste visé : liste des postes, intitulé de la fonction dérivé du poste');
    const FONCTION_SECTION = `Chef de Section — Section nominations ${S} (Division nominations ${S})`;
    const postes = (await call('drh', 'GET', `/api/v1/rh/mouvements?userId=${a}`)).body.postes;
    const pSec = postes.find((x) => x.role === 'CHEF_SECTION' && x.sectionId === sec.id);
    check('liste des postes : DN, DNA, chefs de division, de section, de cellule, avec titulaire', postes.some((x) => x.role === 'DN' && x.titulaire === 'DN Test') && postes.some((x) => x.role === 'DNA') && postes.some((x) => x.role === 'CHEF_DIVISION' && x.divisionId === div.id && x.titulaire === null) && pSec && pSec.fonction === FONCTION_SECTION && pSec.titulaire === `${K.chef.toUpperCase()} Nomination`, JSON.stringify(pSec));
    check('aucune liste de postes hors DRH', (await call('dn', 'GET', `/api/v1/rh/mouvements?userId=${a}`)).body.postes.length === 0);

    console.log('— Signature : changement de rôle pré-rempli en attente, administrateur notifié');
    const t0 = new Date();
    const m1 = await nommer(a, { role: 'CHEF_SECTION', divisionId: div.id, sectionId: sec.id });
    check('fonction de l’acte : intitulé du poste (aucun texte libre)', m1.apres.fonction === FONCTION_SECTION, m1.apres.fonction);
    check('valeurs avant : fonction, rôle et rattachement actuels', m1.avant.role === 'AGENT' && m1.avant.sectionId === sec.id && m1.apres.role === 'CHEF_SECTION');
    const c1 = await changementDe(m1.id);
    check('changement de rôle créé « en attente », acte numéroté, actuel titulaire relevé, rôle proposé : Chargé d’Études', c1 && c1.statut === 'EN_ATTENTE' && c1.acteNumero === m1.acte.numero && c1.ancienTitulaireId === chef && c1.roleAncienTitulaire === 'AGENT', JSON.stringify(c1));
    const apresSignature = await compte(a);
    check('la fonction du dossier suit l’acte, le rôle du compte ne change pas d’office', apresSignature.agent.fonction === FONCTION_SECTION && apresSignature.role === 'AGENT');
    check('administrateur notifié (« Nomination à appliquer », lien vers l’onglet Nominations)', (await prisma.notification.count({ where: { userId: ids.admin, channel: 'IN_APP', createdAt: { gte: t0 }, title: { startsWith: 'Nomination à appliquer' }, link: '/users?onglet=nominations' } })) === 1);
    let drh = (await call('drh', 'GET', `/api/v1/rh/mouvements?userId=${a}`)).body.mouvements.find((x) => x.id === m1.id);
    check('le DRH voit « droits en attente » sur le mouvement', drh.droitsPoste && drh.droitsPoste.statut === 'EN_ATTENTE' && drh.droitsPoste.role === 'CHEF_SECTION');
    const vuParAgent = (await call(K.a, 'GET', '/api/v1/rh/mouvements')).body.mouvements.find((x) => x.id === m1.id);
    check('l’agent voit son mouvement appliqué, sans l’état des droits', vuParAgent && vuParAgent.droitsPoste === null);

    console.log('— Écran de l’administrateur : seul l’administrateur, jamais en intérim');
    for (const k of ['drh', 'dn', 'chefdpe', 'agent1']) expect(`${k} : liste des nominations`, await call(k, 'GET', '/api/v1/changements-role'), 403);
    expect('le DRH confirme', await call('drh', 'POST', `/api/v1/changements-role/${c1.id}/confirmation`, {}), 403);
    expect('le DN refuse', await call('dn', 'POST', `/api/v1/changements-role/${c1.id}/refus`, { motif: 'Pas maintenant' }), 403);
    let l1 = await ligneDe(c1.id);
    check('ligne : agent, poste (rôle et unité), actuel titulaire et rôle proposé', l1 && l1.poste.role === 'CHEF_SECTION' && /Section nominations/.test(l1.poste.unite) && l1.ancienTitulaire.id === chef && l1.ancienTitulaire.propose.role === 'AGENT' && l1.ancienTitulaire.propose.sectionId === sec.id && l1.droits.confirmer, JSON.stringify(l1).slice(0, 300));
    const liste = (await call('admin', 'GET', '/api/v1/changements-role')).body;
    check('écart affiché : nomination en attente', liste.ecarts.some((e) => e.userId === a && e.changementId === c1.id));
    check('listes de choix pour l’actuel titulaire (rôles, divisions et sections, cellules)', liste.choix.roles.some((r) => r.role === 'AGENT') && !liste.choix.roles.some((r) => r.role === 'STAGIAIRE') && liste.choix.divisions.some((d) => d.id === div.id && d.sections.some((s) => s.id === sec.id)));

    console.log('— Supervision : écart signalé, sonde publique inchangée');
    const sup = (await call('admin', 'GET', '/api/v1/supervision')).body;
    const fr = sup.services.find((s) => s.cle === 'fonction-role');
    check('supervision : « Fonction et rôle des comptes » dégradé, nomination en attente comptée', fr && fr.etat === 'DEGRADE' && /en attente/.test(fr.detail), fr && fr.detail);
    const sonde = await (await fetch(`${API}/health/dependances`)).json();
    check('sonde publique : l’écart de gestion n’y figure pas', !('fonction-role' in sonde.services));

    console.log('— Confirmation : 400, échec gardé en attente, puis droits appliqués');
    expect('refus sans motif suffisant', await call('admin', 'POST', `/api/v1/changements-role/${c1.id}/refus`, { motif: 'non' }), 400);
    expect('rôle inconnu pour l’actuel titulaire', await call('admin', 'POST', `/api/v1/changements-role/${c1.id}/confirmation`, { ancienTitulaire: { role: 'PAPE' } }), 400);
    const conflit = await call('admin', 'POST', `/api/v1/changements-role/${c1.id}/confirmation`, { ancienTitulaire: { role: 'CHEF_DIVISION', divisionId: ids.DPE } });
    expect('actuel titulaire vers un poste déjà pourvu (Chef de la DPE)', conflit, 409);
    l1 = await ligneDe(c1.id);
    check('… la nomination reste en attente, avec la raison de l’échec', l1.statut === 'EN_ATTENTE' && /Chef de Division/.test(l1.erreur || ''), l1.erreur);
    check('… aucun rôle n’a changé (ni le nommé, ni l’actuel titulaire)', (await compte(a)).role === 'AGENT' && (await compte(chef)).role === 'CHEF_SECTION');
    console.log('— Tout ou rien : un échec dans la transaction n’applique aucun des deux changements');
    const admin = { id: ids.admin, role: 'ADMIN_SYSTEME', status: 'ACTIF', divisionId: null, sectionId: null, celluleId: null, supervisorRole: null, supervisorCelluleId: null, interimForId: null, rolesFonctionnels: [] };
    const avantRollback = await prisma.auditLog.count({ where: { entityId: { in: [a, chef] } } });
    let echec = null;
    try {
      await roles.changerEnsemble(admin, [
        { userId: chef, dto: { role: 'AGENT', roleAttendu: 'CHEF_SECTION', divisionId: div.id, sectionId: sec.id, motif: 'Essai de transaction' } },
        { userId: a, dto: { role: 'CHEF_SECTION', roleAttendu: 'AGENT', divisionId: div.id, sectionId: sec.id, motif: 'Essai de transaction' } },
      ], { dansTransaction: async () => { throw new Error('échec simulé en fin de transaction'); } });
    } catch (e) { echec = e.message; }
    check('échec simulé après les deux changements : erreur remontée', echec === 'échec simulé en fin de transaction', echec);
    check('… aucun des deux rôles n’a changé, aucune trace écrite', (await compte(a)).role === 'AGENT' && (await compte(chef)).role === 'CHEF_SECTION' && (await prisma.auditLog.count({ where: { entityId: { in: [a, chef] } } })) === avantRollback);
    const t1 = new Date();
    const ok1 = await call('admin', 'POST', `/api/v1/changements-role/${c1.id}/confirmation`, { note: 'Passation le jour même' });
    expect('l’administrateur confirme (rôle proposé pour l’actuel titulaire)', ok1, 200);
    const na = await compte(a), nc = await compte(chef);
    check('le nommé est Chef de Section de l’unité de l’acte', na.role === 'CHEF_SECTION' && na.sectionId === sec.id && na.divisionId === div.id);
    check('l’ancien chef devient Chargé d’Études de la même section', nc.role === 'AGENT' && nc.sectionId === sec.id);
    const c1b = await changementDe(m1.id);
    check('changement « appliqué », décidé par l’administrateur, erreur effacée', c1b.statut === 'APPLIQUE' && c1b.decideParId === ids.admin && c1b.erreur === null);
    const audits = await prisma.auditLog.findMany({ where: { entityId: { in: [a, chef] }, createdAt: { gte: t1 } }, select: { metadata: true } });
    check('deux changements de rôle tracés, motif « Acte de nomination n° … »', audits.filter((x) => x.metadata && x.metadata.event === 'role_change' && x.metadata.motif.startsWith(`Acte de nomination n° ${m1.acte.numero}`)).length === 2);
    check('confirmation tracée (ChangementRoleNomination)', (await prisma.auditLog.count({ where: { entityType: 'ChangementRoleNomination', entityId: c1.id, action: 'VALIDATION' } })) === 1);
    check('DRH informé (« Droits appliqués »)', (await prisma.notification.count({ where: { userId: ids.drh, channel: 'IN_APP', createdAt: { gte: t1 }, title: { startsWith: 'Droits appliqués' } } })) === 1);
    drh = (await call('drh', 'GET', `/api/v1/rh/mouvements?userId=${a}`)).body.mouvements.find((x) => x.id === m1.id);
    check('le DRH voit « droits appliqués »', drh.droitsPoste.statut === 'APPLIQUE');
    expect('seconde confirmation', await call('admin', 'POST', `/api/v1/changements-role/${c1.id}/confirmation`, {}), 409);
    expect('refus d’une nomination appliquée', await call('admin', 'POST', `/api/v1/changements-role/${c1.id}/refus`, { motif: 'Trop tard maintenant' }), 409);
    expect('nomination inconnue', await call('admin', 'POST', '/api/v1/changements-role/inconnue/confirmation', {}), 404);

    console.log('— Nomination sans poste : texte libre, aucun effet sur les droits');
    const mLibre = await nommer(b, { fonction: 'Chargée de mission auprès de la Direction' });
    check('aucun changement de rôle créé, fonction libre écrite au dossier', !(await changementDe(mLibre.id)) && (await compte(b)).agent.fonction === 'Chargée de mission auprès de la Direction');
    drh = (await call('drh', 'GET', `/api/v1/rh/mouvements?userId=${b}`)).body.mouvements.find((x) => x.id === mLibre.id);
    check('… pas d’état des droits sur le mouvement', drh.droitsPoste === null);

    console.log('— Poste déjà tenu : droits appliqués d’emblée, aucune notification');
    const t2 = new Date();
    const m2 = await nommer(a, { fonction: 'texte ignoré', role: 'CHEF_SECTION', divisionId: div.id, sectionId: sec.id });
    const c2 = await changementDe(m2.id);
    check('changement « appliqué » d’emblée, sans titulaire à déplacer', c2.statut === 'APPLIQUE' && c2.ancienTitulaireId === null);
    check('aucune notification « Nomination à appliquer »', (await notifAdmin(t2, 'Nomination à appliquer')) === 0);

    console.log('— Refus motivé : le rôle ne change pas, le DRH le voit');
    const m3 = await nommer(b, { role: 'CHEF_DIVISION', divisionId: div.id });
    const c3 = await changementDe(m3.id);
    check('poste vacant : aucun titulaire relevé', c3.statut === 'EN_ATTENTE' && c3.ancienTitulaireId === null);
    const t3 = new Date();
    expect('l’administrateur refuse avec un motif', await call('admin', 'POST', `/api/v1/changements-role/${c3.id}/refus`, { motif: 'Acte à reprendre : mauvaise division' }), 200);
    check('rôle inchangé', (await compte(b)).role === 'AGENT');
    drh = (await call('drh', 'GET', `/api/v1/rh/mouvements?userId=${b}`)).body.mouvements.find((x) => x.id === m3.id);
    check('le DRH voit « droits refusés » et le motif', drh.droitsPoste.statut === 'REFUSE' && drh.droitsPoste.motifRefus === 'Acte à reprendre : mauvaise division');
    check('DRH informé (« Droits refusés »)', (await prisma.notification.count({ where: { userId: ids.drh, channel: 'IN_APP', createdAt: { gte: t3 }, title: { startsWith: 'Droits refusés' } } })) === 1);
    expect('confirmation après refus', await call('admin', 'POST', `/api/v1/changements-role/${c3.id}/confirmation`, {}), 409);

    console.log('— Écarts quotidiens : fonction du dossier et rôle du compte');
    let ecarts = (await call('admin', 'GET', '/api/v1/changements-role')).body.ecarts;
    check('écart : fonction « Chef de Division » sur un Chargé d’Études (après le refus)', ecarts.some((e) => e.userId === b && e.changementId === null && e.role === 'AGENT'));
    check('aucun écart pour l’ancien chef (aucune fonction de chef à son dossier)', !ecarts.some((e) => e.userId === chef));
    check('aucun écart pour le nommé confirmé', !ecarts.some((e) => e.userId === a));
    const t4 = new Date();
    const r = await nominations.signalerEcarts();
    check('tâche quotidienne : écarts comptés', r.ecarts >= 1, JSON.stringify(r));
    check('administrateurs notifiés des écarts (lien Nominations)', (await prisma.notification.count({ where: { userId: ids.admin, channel: 'IN_APP', createdAt: { gte: t4 }, title: { contains: 'écart(s) à traiter' }, link: '/users?onglet=nominations' } })) === 1);

    console.log('— Direction : aucun rôle proposé d’office pour l’actuel titulaire');
    const m4 = await nommer(b, { role: 'DNA' });
    check('fonction de l’acte : « Directeur National Adjoint »', m4.apres.fonction === 'Directeur National Adjoint');
    const c4 = await changementDe(m4.id);
    check('actuel titulaire relevé (DNA), aucun rôle proposé', c4.ancienTitulaireId === ids.dna && c4.roleAncienTitulaire === null);
    const sansChoix = await call('admin', 'POST', `/api/v1/changements-role/${c4.id}/confirmation`, {});
    check('confirmation sans choisir le rôle de l’actuelle DNA → 400', sansChoix.status === 400 && /Choisissez le nouveau rôle/.test(sansChoix.body.message), sansChoix.status);
    check('… aucun rôle changé (DNA toujours DNA)', (await prisma.user.findUnique({ where: { id: ids.dna } })).role === 'DNA');
    expect('refus motivé (jeu de test)', await call('admin', 'POST', `/api/v1/changements-role/${c4.id}/refus`, { motif: 'Test de la suite : refus' }), 200);
  } finally {
    // Aucun écart ni compte actif laissé aux suites suivantes ; famille rendue à son registre d'avant.
    await prisma.user.updateMany({ where: { id: { in: [chef, a, b] } }, data: { status: 'SUSPENDU' } });
    await prisma.familleActeRh.update({ where: { code: 'DECISION_NOMINATION' }, data: { registreId: familleAvant.registreId } });
    const reste = (await call('admin', 'GET', '/api/v1/changements-role')).body;
    check('fin de suite : aucun écart laissé (comptes de la suite suspendus)', reste.ecarts.every((e) => ![chef, a, b].includes(e.userId)));
    await app.close();
    await prisma.$disconnect();
  }
  bilan();
})().catch((e) => { console.error(e); process.exit(2); });
