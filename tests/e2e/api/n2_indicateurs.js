// Indicateurs de succès (onglet de « Paramétrage et supervision », docs/conception_indicateurs_succes.md) :
// droits (administrateur, DN, DNA en lecture ; 403 journalisé pour tout autre profil), valeurs recalculées
// indépendamment en SQL sur la base de test, cibles bornées modifiables par l'administrateur seul, rien de
// stocké à la lecture.
const { call, ids, check, expect, bilan } = require('../lib');
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
const sql = (q) => prisma.$queryRawUnsafe(q);
const J = 864e5;

(async () => {
  console.log('— Droits');
  const lu = await call('admin', 'GET', '/api/v1/indicateurs-succes');
  expect('administrateur : lecture', lu, 200);
  check('administrateur : cibles modifiables', lu.body.droits?.peutModifier === true);
  for (const k of ['dn', 'dna']) {
    const r = await call(k, 'GET', '/api/v1/indicateurs-succes');
    check(`${k.toUpperCase()} : lecture seule`, r.status === 200 && r.body.droits.peutModifier === false && r.body.indicateurs.length === 5);
  }
  const avantRefus = await prisma.accesRefuse.count({ where: { route: '/api/v1/indicateurs-succes' } });
  for (const k of ['chefdpe', 'agent1', 'drh']) expect(`${k} : refusé`, await call(k, 'GET', '/api/v1/indicateurs-succes'), 403);
  const cleStg = `indstg${Date.now().toString(36)}`;
  await call('admin', 'POST', '/users', { email: `${cleStg}@test.local`, password: 'Password123!', firstName: 'Stagiaire', lastName: 'Indicateurs', role: 'STAGIAIRE' });
  expect('stagiaire : refusé', await call(cleStg, 'GET', '/api/v1/indicateurs-succes'), 403);
  check('refus journalisés (accès refusés)', (await prisma.accesRefuse.count({ where: { route: '/api/v1/indicateurs-succes' } })) >= avantRefus + 3);

  console.log('— Valeurs : recalculées en SQL sur la base de test');
  const ind = Object.fromEntries(lu.body.indicateurs.map((i) => [i.cle, i]));
  check('5 indicateurs mesurables retenus', ['connexionsHebdomadaires', 'decisionsEnTache', 'delaiDecisionConge', 'imputationsDansLesDelais', 'tachesDansLesDelais'].every((c) => ind[c]));
  const t = new Date(lu.body.calculeLe);
  const an = new Date(t.getTime() - 365 * J).toISOString();
  const maint = t.toISOString();
  const pct = (n, s) => (s > 0 ? Math.round((1000 * n) / s) / 10 : null);
  const dec = (await sql(`SELECT count(*)::int AS total, count(t.id)::int AS conv FROM decisions d LEFT JOIN tasks t ON t."sourceDecisionId" = d.id WHERE d."createdAt" >= '${an}' AND d."createdAt" <= '${maint}'`))[0];
  check(`décisions converties en tâche : ${dec.conv}/${dec.total}`, ind.decisionsEnTache.valeur === pct(dec.conv, dec.total) && ind.decisionsEnTache.base === dec.total, JSON.stringify(ind.decisionsEnTache));
  const imp = (await sql(`SELECT count(*)::int AS total, count(*) FILTER (WHERE "traiteeAt" IS NOT NULL AND "traiteeAt" <= echeance)::int AS ok FROM imputations_courrier WHERE echeance IS NOT NULL AND echeance >= '${an}' AND echeance <= '${maint}'`))[0];
  check(`imputations traitées avant échéance : ${imp.ok}/${imp.total}`, ind.imputationsDansLesDelais.valeur === pct(imp.ok, imp.total) && ind.imputationsDansLesDelais.base === imp.total);
  const tac = (await sql(`SELECT count(*)::int AS total, count(*) FILTER (WHERE "completedAt"::date <= "dueDate"::date)::int AS ok FROM tasks WHERE "parentTaskId" IS NULL AND "dueDate" IS NOT NULL AND "completedAt" IS NOT NULL AND status IN ('TERMINEE','VALIDEE') AND "completedAt" >= '${an}' AND "completedAt" <= '${maint}'`))[0];
  check(`tâches terminées dans les délais : ${tac.ok}/${tac.total}`, ind.tachesDansLesDelais.valeur === pct(tac.ok, tac.total) && ind.tachesDansLesDelais.base === tac.total);
  const actifs = (await sql(`SELECT count(*)::int AS n FROM users WHERE status = 'ACTIF' AND email NOT LIKE '%@demo.dnpec.test' AND "createdAt" <= '${maint}'`))[0].n;
  check(`connexions : base = ${actifs} comptes actifs, valeur entre 0 et 100, période indiquée`, ind.connexionsHebdomadaires.base === actifs && (ind.connexionsHebdomadaires.valeur === null || (ind.connexionsHebdomadaires.valeur >= 0 && ind.connexionsHebdomadaires.valeur <= 100)) && /^Du |non mesurable/.test(ind.connexionsHebdomadaires.periode), ind.connexionsHebdomadaires.periode);
  const nbDec = (await sql(`SELECT count(*)::int AS n FROM leave_requests WHERE status IN ('APPROUVEE','REJETEE') AND "decidedAt" >= '${an}' AND "decidedAt" <= '${maint}'`))[0].n;
  check(`délai des congés : moyenne sur ${nbDec} décision(s), en jours ouvrés, sens « ne pas dépasser »`, ind.delaiDecisionConge.base === nbDec && ind.delaiDecisionConge.sens === 'MAX' && ind.delaiDecisionConge.unite === 'jours ouvrés' && (nbDec === 0 ? ind.delaiDecisionConge.valeur === null : ind.delaiDecisionConge.valeur >= 0));
  check('« Atteint » cohérent avec la cible et le sens', lu.body.indicateurs.every((i) => (i.valeur === null ? i.atteint === null : i.atteint === (i.sens === 'MIN' ? i.valeur >= i.cible : i.valeur <= i.cible))));

  console.log('— Connexions : un compte connecté chaque semaine compte, un compte d’une seule semaine non');
  const marque = `ind-${Date.now()}`;
  await sql(`INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, status, "createdAt", "updatedAt") VALUES ('${marque}-a', '${marque}-a@test.local', 'x', 'Assidu', 'Indicateur', 'AGENT', 'ACTIF', now(), now()), ('${marque}-b', '${marque}-b@test.local', 'x', 'Rare', 'Indicateur', 'AGENT', 'ACTIF', now(), now())`);
  const avant = (await call('admin', 'GET', '/api/v1/indicateurs-succes')).body.indicateurs.find((i) => i.cle === 'connexionsHebdomadaires');
  // Le journal doit couvrir 4 semaines pour que la règle complète s'applique : une connexion ancienne témoin.
  await sql(`INSERT INTO journal_connexions (id, "userId", email, resultat, "createdAt") VALUES ('${marque}-ancien', NULL, 'x@test.local', 'ECHEC', now() - interval '40 days')`);
  for (let s = 0; s < 4; s++) await sql(`INSERT INTO journal_connexions (id, "userId", email, resultat, "createdAt") VALUES ('${marque}-a${s}', '${marque}-a', '${marque}-a@test.local', 'SUCCES', now() - interval '${s * 7 + 2} days')`);
  await sql(`INSERT INTO journal_connexions (id, "userId", email, resultat, "createdAt") VALUES ('${marque}-b0', '${marque}-b', '${marque}-b@test.local', 'SUCCES', now() - interval '2 days'), ('${marque}-bx', '${marque}-b', '${marque}-b@test.local', 'ECHEC', now() - interval '9 days')`);
  const apres = (await call('admin', 'GET', '/api/v1/indicateurs-succes')).body.indicateurs.find((i) => i.cle === 'connexionsHebdomadaires');
  const reguliers = (await sql(`SELECT count(*)::int AS n FROM (SELECT j."userId" FROM journal_connexions j JOIN users u ON u.id = j."userId" WHERE j.resultat = 'SUCCES' AND j."createdAt" > now() - interval '28 days' AND u.status = 'ACTIF' AND u.email NOT LIKE '%@demo.dnpec.test' GROUP BY j."userId" HAVING count(DISTINCT floor(extract(epoch FROM (now() - j."createdAt")) / 604800)) = 4) r`))[0].n;
  check(`seul le compte connecté chaque semaine est compté (${reguliers} réguliers), pas celui d’une seule semaine`, apres.base === avant.base && reguliers >= 1 && apres.valeur === pct(reguliers, apres.base) && /4 semaines/.test(apres.periode), `${JSON.stringify(avant)} → ${JSON.stringify(apres)}`);
  await sql(`DELETE FROM journal_connexions WHERE id LIKE '${marque}-%'`);
  await sql(`UPDATE users SET status = 'SUPPRIME' WHERE id LIKE '${marque}-%'`);

  console.log('— Cibles : paramètres bornés, administrateur seul, rien de stocké à la lecture');
  const lignesAvant = (await sql(`SELECT count(*)::int AS n FROM parametres`))[0].n;
  await call('dn', 'GET', '/api/v1/indicateurs-succes');
  check('lecture : aucune ligne de paramètre écrite', (await sql(`SELECT count(*)::int AS n FROM parametres`))[0].n === lignesAvant);
  expect('DN : modifier une cible', await call('dn', 'PATCH', '/api/v1/parametres/indicateurs.cibleDecisionsTachePct', { valeur: 50 }), 403);
  expect('administrateur : cible hors bornes (5 %)', await call('admin', 'PATCH', '/api/v1/parametres/indicateurs.cibleDecisionsTachePct', { valeur: 5 }), 400);
  expect('administrateur : cible des décisions à 55 %', await call('admin', 'PATCH', '/api/v1/parametres/indicateurs.cibleDecisionsTachePct', { valeur: 55 }), 200);
  const r2 = (await call('dna', 'GET', '/api/v1/indicateurs-succes')).body;
  const d2 = r2.indicateurs.find((i) => i.cle === 'decisionsEnTache');
  check('nouvelle cible lue par la DNA, « Atteint » recalculé', d2.cible === 55 && (d2.valeur === null || d2.atteint === d2.valeur >= 55));
  check('cible modifiée : auteur et date', r2.cibles.find((c) => c.cle === 'indicateurs.cibleDecisionsTachePct')?.modifie === true);
  check('cibles absentes de l’onglet « Paramètres »', !(await call('admin', 'GET', '/api/v1/parametres')).body.parametres.some((p) => p.cle.startsWith('indicateurs.')));
  const audit = await prisma.auditLog.findFirst({ where: { entityType: 'Parametre', entityId: 'indicateurs.cibleDecisionsTachePct' }, orderBy: { createdAt: 'desc' } });
  check('modification auditée (avant, après)', audit?.metadata?.apres === 55);
  await call('admin', 'PATCH', '/api/v1/parametres/indicateurs.cibleDecisionsTachePct', { valeur: 60 });

  await prisma.$disconnect();
  process.exitCode = bilan() ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
