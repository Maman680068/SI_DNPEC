// N6 — effectifs et alertes RH (calculés, fermés quand la cause disparaît), pièces requises, familles
// d'actes et mouvements de carrière (acte numéroté du Courrier, application à la signature,
// séquence continue), fiches de poste, besoins de formation, véhicules et carburant, tableau de bord
// par rôle (absences sans motif médical), enveloppe d'erreur api/v1. Cas 400/403/409.
const E = require('../config');
const { call, upload, ids, login, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const API = 'http://localhost:3000';
const S = Date.now().toString(36).slice(-5);
const L = S.toUpperCase().replace(/\d/g, (x) => 'ABCDEFGHIJ'[x]);
const J = 864e5;
const jour = (n) => new Date(Date.now() + n * J).toISOString().slice(0, 10);
const alertesDe = async (userId) => (await call('drh', 'GET', '/api/v1/rh/alertes')).body.filter((a) => a.userId === userId);

async function signerActe(acteId, soumettant) {
  expect('soumission de l’acte (circuit du Courrier)', await call(soumettant, 'POST', `/courrier/actes/${acteId}/soumettre`), 201);
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

(async () => {
  console.log('— Effectifs (calculés, jamais saisis) et enveloppe api/v1');
  const eff = await call('drh', 'GET', '/api/v1/rh/effectifs');
  check('DRH : effectifs par unité, statut, catégorie, ancienneté, part des femmes', eff.status === 200 && eff.body.total > 0 && Array.isArray(eff.body.parUnite) && Array.isArray(eff.body.parStatut) && Array.isArray(eff.body.parCategorie) && 'partFemmes' in eff.body, eff.status);
  const effDn = await call('dn', 'GET', '/api/v1/rh/effectifs');
  check('DN : mêmes agrégats, aucun nom d’agent', effDn.status === 200 && effDn.body.total === eff.body.total && !JSON.stringify(effDn.body).includes('Test'));
  const refus = await call('agent1', 'GET', '/api/v1/rh/effectifs');
  check('agent : 403 au format api/v1 (code, message, trace_id)', refus.status === 403 && refus.body.code === 'DROIT_INSUFFISANT' && !!refus.body.trace_id);
  expect('chef de division : effectifs', await call('chefdpe', 'GET', '/api/v1/rh/effectifs'), 403);
  const agentsAvant = eff.body.total;
  const agent2 = await prisma.user.findUnique({ where: { id: ids.agent2 }, select: { agentId: true } });
  await prisma.agent.update({ where: { id: agent2.agentId }, data: { genre: 'F' } });
  const eff2 = (await call('drh', 'GET', '/api/v1/rh/effectifs')).body;
  check('effectifs recalculés à la lecture (genre renseigné pris en compte)', eff2.total === agentsAvant && eff2.femmes >= 1);

  console.log('— Pièces requises (liste tenue par le DRH)');
  const pieces = (await call('agent1', 'GET', '/api/v1/rh/pieces-requises')).body;
  check('liste livrée (5 pièces) lisible par l’agent, sans droit de gestion', pieces.pieces.length >= 5 && pieces.droits.gerer === false);
  expect('l’agent ajoute une pièce requise', await call('agent1', 'POST', '/api/v1/rh/pieces-requises', { libelle: `Attestation ${S}` }), 403);
  const pr = await call('drh', 'POST', '/api/v1/rh/pieces-requises', { libelle: `Attestation de domicile ${S}`, ordre: 9 });
  expect('le DRH ajoute une pièce requise', pr, 201);
  expect('pièce déjà présente', await call('drh', 'POST', '/api/v1/rh/pieces-requises', { libelle: `Attestation de domicile ${S}` }), 409);

  console.log('— Alertes RH : dossier incomplet (pièce nommée), fermeture quand la cause disparaît');
  expect('agent : alertes RH', await call('agent1', 'GET', '/api/v1/rh/alertes'), 403);
  expect('DN : alertes RH (elles nomment des agents)', await call('dn', 'GET', '/api/v1/rh/alertes'), 403);
  expect('le DRH complète le dossier de l’agent (catégorie, statut, grade, échelon, prise de service)', await call('drh', 'PATCH', `/personnel-files/${ids.agent1}/basic`, { employmentStatus: 'CONTRACTUEL', grade: 'Attaché', echelon: '2', categorie: 'A', serviceStartDate: '2022-03-01' }), 200);
  let a1 = await alertesDe(ids.agent1);
  const dossier = a1.find((a) => a.type === 'DOSSIER_INCOMPLET');
  check('dossier incomplet : la pièce manquante est nommée', !!dossier && dossier.detail.includes(`Attestation de domicile ${S}`), dossier && dossier.detail);
  const actives = (await call('drh', 'GET', '/api/v1/rh/pieces-requises')).body.pieces.filter((p) => p.actif);
  for (const p of actives) {
    await upload('drh', `/personnel-files/${ids.agent1}/documents`, { label: p.libelle, pieceRequiseId: p.id }, [{ field: 'file', name: 'piece.pdf' }]);
  }
  expect('pièce requise inconnue', await upload('drh', `/personnel-files/${ids.agent1}/documents`, { label: 'X', pieceRequiseId: 'inconnue' }, [{ field: 'file', name: 'x.pdf' }]), 400);
  a1 = await alertesDe(ids.agent1);
  check('toutes les pièces enregistrées : l’alerte « dossier incomplet » est fermée', !a1.some((a) => a.type === 'DOSSIER_INCOMPLET'), JSON.stringify(a1.map((a) => a.detail)));
  expect('le DRH retire la pièce ajoutée de la liste', await call('drh', 'PATCH', `/api/v1/rh/pieces-requises/${pr.body.id}`, { actif: false }), 200);

  console.log('— Alertes RH : fin de contrat, avancement d’échelon à instruire');
  await prisma.agent.update({ where: { id: agent2.agentId }, data: { dateFinPrevue: new Date(jour(2) + 'T00:00:00Z'), natureFinPrevue: 'CONTRAT', finConfirmeeAt: null } });
  let a2 = await alertesDe(ids.agent2);
  check('fin de contrat dans 2 jours : alerte urgente (HAUTE) en tête', a2.some((a) => a.type === 'FIN_CONTRAT' && a.priorite === 'HAUTE'));
  await prisma.agent.update({ where: { id: agent2.agentId }, data: { dateFinPrevue: new Date(jour(200) + 'T00:00:00Z') } });
  a2 = await alertesDe(ids.agent2);
  check('fin prolongée au-delà de l’horizon : l’alerte disparaît', !a2.some((a) => a.type === 'FIN_CONTRAT'));
  await prisma.agent.update({ where: { id: agent2.agentId }, data: { dateFinPrevue: null, natureFinPrevue: null } });
  expect('agent2 : fonctionnaire, échelon 3 depuis 3 ans', await call('drh', 'PATCH', `/personnel-files/${ids.agent2}/basic`, { employmentStatus: 'FONCTIONNAIRE', grade: 'Administrateur', echelon: '3', categorie: 'A', serviceStartDate: '2015-01-01', echelonDepuis: jour(-3 * 365) }), 200);
  a2 = await alertesDe(ids.agent2);
  check('avancement d’échelon à instruire (paramètre : 24 mois)', a2.some((a) => a.type === 'AVANCEMENT_ECHELON'));

  console.log('— Familles d’actes : registre propre (séquence) et signataire');
  expect('agent : familles d’actes', await call('agent1', 'GET', '/api/v1/rh/familles-actes'), 403);
  const fam = (await call('drh', 'GET', '/api/v1/rh/familles-actes')).body;
  check('6 familles livrées, signataire DN ou DNA', fam.familles.length === 6 && fam.familles.every((f) => f.signataire === 'DN ou DNA') && fam.droits.gerer);
  const regAv = (await call('admin', 'POST', '/courrier/registres', { code: `DAV${L}`, libelle: `Décisions d’avancement ${S}`, nature: 'ACTE', portee: 'DIRECTION', gabaritNumero: 'DAV/{seq:3}/{annee}' })).body;
  const regAff = (await call('admin', 'POST', '/courrier/registres', { code: `AAF${L}`, libelle: `Arrêtés d’affectation ${S}`, nature: 'ACTE', portee: 'DIRECTION', gabaritNumero: 'AAF/{seq:3}/{annee}' })).body;
  const regNom = (await call('admin', 'POST', '/courrier/registres', { code: `DNO${L}`, libelle: `Décisions de nomination ${S}`, nature: 'ACTE', portee: 'DIRECTION', gabaritNumero: 'DNO/{seq:3}/{annee}' })).body;
  const regUnite = (await call('admin', 'POST', '/courrier/registres', { code: `UNI${L}`, libelle: `Registre d’unité ${S}`, nature: 'ACTE', portee: 'UNITE', gabaritNumero: 'U/{seq}/{annee}' })).body;
  expect('registre d’unité refusé (signature par la Direction)', await call('drh', 'PATCH', '/api/v1/rh/familles-actes/DECISION_AVANCEMENT', { registreId: regUnite.id }), 400);
  expect('l’agent choisit un registre', await call('agent1', 'PATCH', '/api/v1/rh/familles-actes/DECISION_AVANCEMENT', { registreId: regAv.id }), 403);

  console.log('— Mouvement de carrière : préparation, acte, signature, application');
  const AV = { userId: ids.agent2, type: 'AVANCEMENT_ECHELON', dateEffet: jour(0), apres: { echelon: '4' } };
  expect('l’agent prépare un mouvement', await call('agent1', 'POST', '/api/v1/rh/mouvements', AV), 403);
  expect('le DRH ne s’instruit pas lui-même', await call('drh', 'POST', '/api/v1/rh/mouvements', { ...AV, userId: ids.drh }), 403);
  expect('valeur après manquante', await call('drh', 'POST', '/api/v1/rh/mouvements', { ...AV, apres: {} }), 400);
  const mv = await call('drh', 'POST', '/api/v1/rh/mouvements', AV);
  check('le DRH prépare l’avancement (avant : échelon 3)', mv.status === 201 && mv.body.avant.echelon === '3' && mv.body.statut === 'PREPARE', mv.status);
  expect('second avancement en cours', await call('drh', 'POST', '/api/v1/rh/mouvements', AV), 409);
  a2 = await alertesDe(ids.agent2);
  check('mouvement en cours : l’alerte d’avancement est retirée', !a2.some((a) => a.type === 'AVANCEMENT_ECHELON'));
  const sansRegistre = await call('drh', 'POST', `/api/v1/rh/mouvements/${mv.body.id}/acte`);
  check('acte refusé tant que la famille n’a pas de registre (409, message)', sansRegistre.status === 409 && /registre/.test(sansRegistre.body.message), sansRegistre.status);
  expect('le DRH choisit le registre de la famille', await call('drh', 'PATCH', '/api/v1/rh/familles-actes/DECISION_AVANCEMENT', { registreId: regAv.id }), 200);
  expect('le même registre pour une autre famille', await call('drh', 'PATCH', '/api/v1/rh/familles-actes/ARRETE_AFFECTATION', { registreId: regAv.id }), 409);
  await call('drh', 'PATCH', '/api/v1/rh/familles-actes/ARRETE_AFFECTATION', { registreId: regAff.id });
  await call('drh', 'PATCH', '/api/v1/rh/familles-actes/DECISION_NOMINATION', { registreId: regNom.id });
  const ac = await call('drh', 'POST', `/api/v1/rh/mouvements/${mv.body.id}/acte`);
  expect('le DRH prépare l’acte du mouvement', ac, 201);
  expect('seconde préparation', await call('drh', 'POST', `/api/v1/rh/mouvements/${mv.body.id}/acte`), 409);
  expect('annulation d’un mouvement dont l’acte est en cours', await call('drh', 'POST', `/api/v1/rh/mouvements/${mv.body.id}/annulation`), 409);
  const acte = await prisma.acteCourrier.findUnique({ where: { id: ac.body.acteId }, include: { pieces: true } });
  check('acte au registre de la famille, bénéficiaire l’agent, décision jointe', acte.registreId === regAv.id && acte.beneficiaireId === ids.agent2 && acte.pieces.length === 1);
  expect('avant signature : le dossier garde l’échelon 3', await call('drh', 'GET', `/personnel-files/${ids.agent2}`), 200);
  check('… échelon toujours 3', (await prisma.personnelFileBasic.findUnique({ where: { userId: ids.agent2 } })).echelon === '3');
  const signe1 = await signerActe(ac.body.acteId, 'drh');
  const f2 = await prisma.personnelFileBasic.findUnique({ where: { userId: ids.agent2 } });
  const m1 = await prisma.mouvementCarriere.findUnique({ where: { id: mv.body.id } });
  check('signature : échelon 4 appliqué au dossier, date du dernier échelon = date d’effet', f2.echelon === '4' && f2.echelonDepuis.toISOString().slice(0, 10) === jour(0));
  check('mouvement « Appliqué » ; numéro de la séquence de la famille (DAV/001/…)', m1.statut === 'APPLIQUE' && /^DAV\/001\//.test(signe1.numero), signe1.numero);
  check('Direction notifiée de l’application', (await prisma.notification.count({ where: { userId: ids.dn, title: { contains: 'Avancement d’échelon appliqué' } } })) >= 1);
  check('journal d’audit : application tracée', (await prisma.auditLog.count({ where: { entityId: mv.body.id, metadata: { path: ['event'], equals: 'applique' } } })) === 1);

  console.log('— Séquence continue, mouvements visibles par l’agent concerné seulement');
  const pro = await call('drh', 'POST', '/api/v1/rh/mouvements', { userId: ids.agent2, type: 'PROMOTION', dateEffet: jour(0), apres: { grade: 'Administrateur principal', echelon: '1' } });
  expect('promotion préparée', pro, 201);
  const acPro = await call('drh', 'POST', `/api/v1/rh/mouvements/${pro.body.id}/acte`);
  const signe2 = await signerActe(acPro.body.acteId, 'drh');
  check('même famille : numéro suivant (DAV/002/…), sans trou', /^DAV\/002\//.test(signe2.numero), signe2.numero);
  check('promotion appliquée : grade et échelon', (await prisma.personnelFileBasic.findUnique({ where: { userId: ids.agent2 } })).grade === 'Administrateur principal');
  const vueAgent = (await call('agent2', 'GET', '/api/v1/rh/mouvements')).body;
  check('l’agent voit ses mouvements appliqués', vueAgent.mouvements.length >= 2 && vueAgent.mouvements.every((m) => m.userId === ids.agent2 && m.statut === 'APPLIQUE'));
  expect('un agent consulte les mouvements d’un autre', await call('agent1', 'GET', `/api/v1/rh/mouvements?userId=${ids.agent2}`), 403);
  check('le DN lit les mouvements', (await call('dn', 'GET', `/api/v1/rh/mouvements?userId=${ids.agent2}`)).body.mouvements.length >= 2);

  console.log('— Mutation (rattachement), nomination, fin de contrat');
  expect('mutation d’un chef (passe par le changement de rôle)', await call('drh', 'POST', '/api/v1/rh/mouvements', { userId: ids.chefssr, type: 'MUTATION', dateEffet: jour(0), apres: { divisionId: ids.DEE } }), 409);
  expect('mutation vers le même rattachement', await call('drh', 'POST', '/api/v1/rh/mouvements', { userId: ids.agentdee, type: 'MUTATION', dateEffet: jour(0), apres: { divisionId: ids.DEE, sectionId: ids.SE } }), 409);
  expect('section hors de la division', await call('drh', 'POST', '/api/v1/rh/mouvements', { userId: ids.agentdee, type: 'MUTATION', dateEffet: jour(0), apres: { divisionId: ids.DPE, sectionId: ids.SE } }), 400);
  const mu = await call('drh', 'POST', '/api/v1/rh/mouvements', { userId: ids.agentdee, type: 'MUTATION', dateEffet: jour(0), apres: { divisionId: ids.DPE, sectionId: ids.SFP } });
  expect('mutation préparée (vers la DPE)', mu, 201);
  const acMu = await call('drh', 'POST', `/api/v1/rh/mouvements/${mu.body.id}/acte`);
  const signe3 = await signerActe(acMu.body.acteId, 'drh');
  const ad = await prisma.user.findUnique({ where: { id: ids.agentdee }, select: { divisionId: true, sectionId: true, agent: { select: { unite: { select: { sectionId: true } } } } } });
  check('arrêté d’affectation signé (AAF/001) : rattachement appliqué, unité de l’agent synchronisée', /^AAF\/001\//.test(signe3.numero) && ad.divisionId === ids.DPE && ad.sectionId === ids.SFP && ad.agent.unite.sectionId === ids.SFP);
  const retourMu = await call('drh', 'POST', '/api/v1/rh/mouvements', { userId: ids.agentdee, type: 'MUTATION', dateEffet: jour(0), apres: { divisionId: ids.DEE, sectionId: ids.SE } });
  const acRet = await call('drh', 'POST', `/api/v1/rh/mouvements/${retourMu.body.id}/acte`);
  await signerActe(acRet.body.acteId, 'drh');
  check('mutation retour : rattachement d’origine rétabli', (await prisma.user.findUnique({ where: { id: ids.agentdee } })).divisionId === ids.DEE);
  expect('fin de contrat sans motif', await call('drh', 'POST', '/api/v1/rh/mouvements', { userId: ids.agent2, type: 'FIN_CONTRAT', dateEffet: jour(90), apres: {} }), 400);
  const fc = await call('drh', 'POST', '/api/v1/rh/mouvements', { userId: ids.agent2, type: 'FIN_CONTRAT', dateEffet: jour(90), motif: 'Fin du projet', apres: {} });
  expect('fin de contrat préparée', fc, 201);
  expect('annulation d’un mouvement préparé', await call('drh', 'POST', `/api/v1/rh/mouvements/${fc.body.id}/annulation`), 200);
  expect('annulation rejouée', await call('drh', 'POST', `/api/v1/rh/mouvements/${fc.body.id}/annulation`), 409);

  console.log('— Fiches de poste (par fonction) et besoins de formation');
  const fonction = `Chargé d’études ${S}`;
  expect('l’agent rédige une fiche', await call('agent1', 'POST', '/api/v1/rh/fiches-poste', { fonction, missions: 'Analyser la conjoncture économique.' }), 403);
  const fp = await call('drh', 'POST', '/api/v1/rh/fiches-poste', { fonction, missions: 'Analyser la conjoncture économique et rédiger les notes.', competences: 'Économétrie' });
  expect('le DRH rédige la fiche de poste de la fonction', fp, 201);
  expect('fiche déjà existante pour la fonction', await call('drh', 'POST', '/api/v1/rh/fiches-poste', { fonction, missions: 'Autre texte de missions.' }), 409);
  const ancienTitre = (await prisma.user.findUnique({ where: { id: ids.agent1 } })).jobTitle;
  await prisma.user.update({ where: { id: ids.agent1 }, data: { jobTitle: fonction } });
  const fa = (await call('agent1', 'GET', '/api/v1/rh/fiches-poste')).body;
  check('l’agent lit la fiche de sa fonction (rattachée à la fonction, pas à la personne)', fa.maFicheId === fp.body.id && fa.droits.gerer === false);
  await prisma.user.update({ where: { id: ids.agent1 }, data: { jobTitle: ancienTitre } });
  const annee = new Date().getUTCFullYear();
  expect('l’agent exprime un besoin', await call('agent1', 'POST', '/api/v1/rh/formation', { annee, intitule: 'Excel avancé', priorite: 'HAUTE', origine: 'ENTRETIEN' }), 403);
  expect('priorité inconnue', await call('chefdpe', 'POST', '/api/v1/rh/formation', { annee, intitule: 'Excel avancé', priorite: 'URGENTE', origine: 'ENTRETIEN' }), 400);
  const bf = await call('chefdpe', 'POST', '/api/v1/rh/formation', { annee, intitule: `Modélisation macroéconomique ${S}`, priorite: 'HAUTE', origine: 'PLAN_TRAVAIL', effectif: 4 });
  expect('le chef de division exprime un besoin pour sa division', bf, 201);
  check('le chef d’une autre division ne le voit pas', !(await call('chefdee', 'GET', `/api/v1/rh/formation?annee=${annee}`)).body.besoins.some((b) => b.id === bf.body.id));
  check('le DRH voit tous les besoins, avec l’unité', (await call('drh', 'GET', `/api/v1/rh/formation?annee=${annee}`)).body.besoins.some((b) => b.id === bf.body.id && b.unite));
  expect('le chef retient lui-même le besoin', await call('chefdpe', 'PATCH', `/api/v1/rh/formation/${bf.body.id}/statut`, { statut: 'RETENU' }), 403);
  expect('le DRH retient le besoin dans le plan', await call('drh', 'PATCH', `/api/v1/rh/formation/${bf.body.id}/statut`, { statut: 'RETENU' }), 200);

  console.log('— Véhicules, missions et carburant');
  if (!(await prisma.habilitationLogistique.findFirst({ where: { revoqueeAt: null, userId: ids.agentsaf } }))) await call('admin', 'POST', '/logistique/habilitations', { userId: ids.agentsaf });
  const VH = { immatriculation: `RC ${L.slice(0, 4)} A`, marque: 'Toyota', modele: 'Hilux', energie: 'GAZOLE', kilometrage: 42000 };
  expect('un agent ajoute un véhicule', await call('agent1', 'POST', '/api/v1/vehicules', VH), 403);
  const vh = await call('agentsaf', 'POST', '/api/v1/vehicules', VH);
  expect('le gestionnaire logistique ajoute un véhicule', vh, 201);
  expect('immatriculation déjà enregistrée', await call('agentsaf', 'POST', '/api/v1/vehicules', VH), 409);
  check('parc lisible par un agent (sans droit de gestion)', (await call('agent1', 'GET', '/api/v1/vehicules')).body.vehicules.some((v) => v.id === vh.body.id));
  expect('plein : compteur qui recule', await call('agentsaf', 'POST', `/api/v1/vehicules/${vh.body.id}/pleins`, { date: jour(0), litres: 40, montant: 480000, kilometrage: 41000 }), 409);
  expect('plein daté du futur', await call('agentsaf', 'POST', `/api/v1/vehicules/${vh.body.id}/pleins`, { date: jour(3), litres: 40, montant: 480000, kilometrage: 42100 }), 400);
  expect('premier plein', await call('agentsaf', 'POST', `/api/v1/vehicules/${vh.body.id}/pleins`, { date: jour(-10), litres: 50, montant: 600000, kilometrage: 42000 }), 201);
  expect('second plein', await call('agentsaf', 'POST', `/api/v1/vehicules/${vh.body.id}/pleins`, { date: jour(0), litres: 40, montant: 480000, kilometrage: 42500 }), 201);
  const det = (await call('agent1', 'GET', `/api/v1/vehicules/${vh.body.id}`)).body;
  check('consommation calculée : 40 L sur 500 km = 8 L/100 km ; compteur à 42 500 km', det.consommationL100 === 8 && det.kilometrage === 42500 && det.litresTotal === 90, JSON.stringify({ c: det.consommationL100, k: det.kilometrage }));
  const OM = { agentId: ids.agent1, objet: `Collecte ${S}`, destination: 'Labé', dateDepart: jour(20), dateRetour: jour(24), transport: 'Véhicule de service', fraisMontant: 300000 };
  const om1 = (await call('chefssr', 'POST', '/api/v1/ordres-mission', OM)).body;
  const om2 = (await call('chefssr', 'POST', '/api/v1/ordres-mission', { ...OM, objet: `Collecte bis ${S}`, dateDepart: jour(22), dateRetour: jour(26) })).body;
  expect('un agent affecte un véhicule', await call('agent1', 'POST', `/api/v1/vehicules/missions/${om1.id}/vehicule`, { vehiculeId: vh.body.id }), 403);
  const af = await call('agentsaf', 'POST', `/api/v1/vehicules/missions/${om1.id}/vehicule`, { vehiculeId: vh.body.id });
  check('le gestionnaire affecte le véhicule à la mission (kilométrage au départ = compteur)', af.status === 200 && (await prisma.ordreMission.findUnique({ where: { id: om1.id } })).kilometrageDepart === 42500);
  expect('le même véhicule sur une mission qui chevauche', await call('agentsaf', 'POST', `/api/v1/vehicules/missions/${om2.id}/vehicule`, { vehiculeId: vh.body.id }), 409);
  expect('retour inférieur au départ', await call('agentsaf', 'POST', `/api/v1/vehicules/missions/${om1.id}/retour`, { kilometrageRetour: 42000 }), 400);
  const ret = await call('agentsaf', 'POST', `/api/v1/vehicules/missions/${om1.id}/retour`, { kilometrageRetour: 43280 });
  check('retour de mission : 780 km parcourus, compteur du véhicule mis à jour', ret.status === 200 && ret.body.distance === 780 && (await prisma.vehicule.findUnique({ where: { id: vh.body.id } })).kilometrage === 43280);
  expect('retour rejoué', await call('agentsaf', 'POST', `/api/v1/vehicules/missions/${om1.id}/retour`, { kilometrageRetour: 43300 }), 409);
  let refusBase = null;
  try { await prisma.ordreMission.update({ where: { id: om1.id }, data: { kilometrageRetour: 100 } }); } catch (e) { refusBase = e; }
  check('contrôle en base : retour jamais inférieur au départ', !!refusBase);
  expect('véhicule mis en panne', await call('agentsaf', 'PATCH', `/api/v1/vehicules/${vh.body.id}`, { etat: 'EN_PANNE' }), 200);
  expect('véhicule en panne affecté à une mission', await call('agentsaf', 'POST', `/api/v1/vehicules/missions/${om2.id}/vehicule`, { vehiculeId: vh.body.id }), 409);

  console.log('— Tableau de bord par rôle (jamais plus que les écrans)');
  if (!(await call('agent1', 'GET', '/leave-types')).body.some((x) => x.code === 'CONGE_MALADIE')) await call('admin', 'POST', '/leave-types', { code: 'CONGE_MALADIE', name: 'Congé maladie' });
  const maladie = (await call('agent1', 'GET', '/leave-types')).body.find((x) => x.code === 'CONGE_MALADIE');
  const cm = (await call('agent1', 'POST', '/leaves', { leaveTypeId: maladie.id, startDate: jour(0), endDate: jour(1), reason: `Hospitalisation ${S}` })).body;
  await call('chefssr', 'POST', `/leaves/${cm.id}/avis`, { avis: 'FAVORABLE' });
  await call('drh', 'POST', `/leaves/${cm.id}/approve`, {});
  const tdn = (await call('dn', 'GET', '/api/v1/tableau-de-bord')).body;
  const cles = (t) => t.blocs.map((b) => b.cle);
  check('DN : plan, décisions, instructions, absences du jour', ['plan', 'decisions', 'instructions', 'absences'].every((c) => cles(tdn).includes(c)) && tdn.profil === 'DIRECTION', cles(tdn).join(','));
  const absDn = tdn.blocs.find((b) => b.cle === 'absences');
  const ligneDn = absDn.elements.find((e) => e.libelle.startsWith('AGENT1'));
  check('DN : l’absence de l’agent apparaît, sans la nature médicale ni le motif', !!ligneDn && !/maladie/i.test(ligneDn.detail) && !JSON.stringify(tdn).includes(`Hospitalisation ${S}`), ligneDn && ligneDn.detail);
  const tdrh = (await call('drh', 'GET', '/api/v1/tableau-de-bord')).body;
  check('DRH : décisions attendues, alertes RH, absences', ['conges-decision', 'alertes-rh', 'absences'].every((c) => cles(tdrh).includes(c)));
  check('DRH : le type « Congé maladie » est affiché (il le voit à l’écran)', /maladie/i.test(JSON.stringify(tdrh.blocs.find((b) => b.cle === 'absences'))));
  const tag = (await call('agent1', 'GET', '/api/v1/tableau-de-bord')).body;
  check('agent : mes tâches, mon solde, mes demandes, réunions ; ni alertes RH ni absences', ['taches', 'solde', 'demandes', 'reunions'].every((c) => cles(tag).includes(c)) && !cles(tag).includes('alertes-rh') && !cles(tag).includes('absences'));
  const tcs = (await call('chefssr', 'GET', '/api/v1/tableau-de-bord')).body;
  check('chef de section : avis attendus, absences à 7 jours, activités', ['conges-avis', 'absences', 'activites'].every((c) => cles(tcs).includes(c)));
  check('administrateur : comptes en attente', cles((await call('admin', 'GET', '/api/v1/tableau-de-bord')).body).includes('comptes'));
  await call('agent1', 'POST', `/leaves/${cm.id}/cancel`);

  await prisma.$disconnect();
  process.exit(bilan() ? 1 : 0);
})().catch(async (e) => { console.error(e); process.exit(2); });
