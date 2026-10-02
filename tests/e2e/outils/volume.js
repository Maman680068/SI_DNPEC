// Jeu de données de VOLUME pour les mesures de performance (octobre 2026) — base LOCALE uniquement.
// Ajoute au jeu de test (après la suite c1_setup ou la suite complète) :
//   300 agents (comptes vol<n>@test.local, mot de passe Password123!) répartis dans les sections et
//   cellules ; 20 000 tâches assignées (statuts et échéances variés) ; 3 000 demandes de congé ;
//   3 000 documents de la GED ; 2 000 courriers arrivée ; 150 000 notifications ; 100 000 lignes
//   d'audit. Idempotent : ne fait rien si les comptes de volume existent déjà.
//   NODE_PATH=apps/api/node_modules node tests/e2e/outils/volume.js
const { PrismaClient } = require('@prisma/client');

const url = process.env.DATABASE_URL || '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error('Refusé : DATABASE_URL ne pointe pas vers une base locale.');
  process.exit(1);
}
const prisma = new PrismaClient();
const sql = (s) => prisma.$executeRawUnsafe(s);

(async () => {
  if ((await prisma.user.count({ where: { email: { startsWith: 'vol' }, AND: { email: { endsWith: '@test.local' } } } })) > 0) {
    console.log('Volume déjà présent : rien à faire.');
    return;
  }
  const t0 = Date.now();
  const modele = await prisma.user.findUniqueOrThrow({ where: { email: 'agent1@test.local' }, select: { passwordHash: true } });
  const sections = await prisma.section.findMany({ select: { id: true, divisionId: true } });
  const cellules = await prisma.cellule.findMany({ select: { id: true } });
  const unites = [...sections.map((s) => `('${s.divisionId}','${s.id}',NULL)`), ...cellules.map((c) => `(NULL,NULL,'${c.id}')`)];

  // 300 agents (Chargés d'études), répartis : 75 % dans les sections, 25 % dans les cellules.
  await sql(`
    WITH u(i, d, s, c) AS (
      SELECT g, x.d, x.s, x.c FROM generate_series(1,300) g
      JOIN LATERAL (SELECT * FROM (VALUES ${unites.join(',')}) v(d,s,c) OFFSET (g % ${unites.length}) LIMIT 1) x ON true
    )
    INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, status, "divisionId", "sectionId", "celluleId", "updatedAt")
    SELECT 'vol-u-'||i, 'vol'||i||'@test.local', '${modele.passwordHash}', 'Agent', 'Volume'||lpad(i::text,3,'0'), 'AGENT', 'ACTIF', d, s, c, now() FROM u`);

  // 20 000 tâches, une à deux personnes assignées, statuts et échéances variés.
  await sql(`
    INSERT INTO tasks (id, title, description, status, priority, "createdById", "divisionId", "sectionId", "celluleId", "dueDate", "createdAt", "updatedAt")
    SELECT 'vol-t-'||g, 'Tâche '||g||' — note de conjoncture et suivi des indicateurs',
      repeat('Analyse des séries, rédaction et vérification. ', 4),
      (ARRAY['A_FAIRE','EN_COURS','SOUMISE_VALIDATION','TERMINEE','VALIDEE'])[1 + g % 5]::task_status,
      (ARRAY['FAIBLE','NORMAL','URGENT'])[1 + g % 3]::task_priority,
      u.id, u."divisionId", u."sectionId", u."celluleId",
      now() + ((g % 150) - 60) * interval '1 day', now() - (g % 365) * interval '1 day', now()
    FROM generate_series(1,20000) g JOIN users u ON u.id = 'vol-u-'||(1 + g % 300)`).catch(async (e) => {
    // Libellés de priorité différents selon les versions : on se rabat sur la valeur par défaut.
    if (!/task_priority/.test(String(e))) throw e;
    await sql(`
      INSERT INTO tasks (id, title, description, status, "createdById", "divisionId", "sectionId", "celluleId", "dueDate", "createdAt", "updatedAt")
      SELECT 'vol-t-'||g, 'Tâche '||g||' — note de conjoncture et suivi des indicateurs', repeat('Analyse des séries, rédaction et vérification. ', 4),
        (ARRAY['A_FAIRE','EN_COURS','SOUMISE_VALIDATION','TERMINEE','VALIDEE'])[1 + g % 5]::task_status, u.id, u."divisionId", u."sectionId", u."celluleId",
        now() + ((g % 150) - 60) * interval '1 day', now() - (g % 365) * interval '1 day', now()
      FROM generate_series(1,20000) g JOIN users u ON u.id = 'vol-u-'||(1 + g % 300)`);
  });
  await sql(`INSERT INTO task_assignees (id, "taskId", "userId") SELECT 'vol-ta-'||g, 'vol-t-'||g, 'vol-u-'||(1 + g % 300) FROM generate_series(1,20000) g`);
  await sql(`INSERT INTO task_assignees (id, "taskId", "userId") SELECT 'vol-tb-'||g, 'vol-t-'||g, 'vol-u-'||(1 + (g + 7) % 300) FROM generate_series(1,20000,3) g`);

  // 3 000 demandes de congé.
  for (const [code, name] of [['CONGE_ANNUEL', 'Congé annuel'], ['CONGE_MALADIE', 'Congé maladie'], ['PERMISSION', 'Permission']]) {
    await prisma.leaveType.upsert({ where: { code }, update: {}, create: { code, name } });
  }
  const types = await prisma.leaveType.findMany({ select: { id: true } });
  await sql(`
    INSERT INTO leave_requests (id, "userId", "leaveTypeId", "startDate", "endDate", "daysCount", status, reason, "updatedAt")
    SELECT 'vol-l-'||g, 'vol-u-'||(1 + g % 300), (ARRAY[${types.map((t) => `'${t.id}'`).join(',')}])[1 + g % ${types.length}],
      now() + ((g % 200) - 100) * interval '1 day', now() + ((g % 200) - 97) * interval '1 day', 3,
      (ARRAY['EN_ATTENTE','APPROUVEE','REJETEE','APPROUVEE'])[1 + g % 4]::leave_request_status, 'Congé de volume', now()
    FROM generate_series(1,3000) g`);

  // 3 000 documents de la GED (fichier livré avec l'application, jamais le stockage).
  await sql(`
    INSERT INTO documents (id, title, "createdById", "divisionId", "updatedAt")
    SELECT 'vol-d-'||g, 'Document de volume '||g||' — rapport trimestriel', u.id, COALESCE(u."divisionId", (SELECT id FROM divisions LIMIT 1)), now()
    FROM generate_series(1,3000) g JOIN users u ON u.id = 'vol-u-'||(1 + g % 300)`);
  await sql(`
    INSERT INTO document_versions (id, "documentId", "versionNumber", "fileName", "fileKey", "mimeType", "sizeBytes", "uploadedById")
    SELECT 'vol-dv-'||g, 'vol-d-'||g, 1, 'rapport.pdf', 'integre:demo-document-dnpec.pdf', 'application/pdf', 1000, 'vol-u-'||(1 + g % 300)
    FROM generate_series(1,3000) g`);

  // 2 000 courriers arrivée dans le premier registre « Direction » de nature arrivée.
  const reg = await prisma.registreCourrier.findFirst({ where: { nature: 'ARRIVEE', portee: 'DIRECTION' }, select: { id: true } });
  if (reg) {
    const an = new Date().getUTCFullYear();
    await sql(`
      INSERT INTO courriers_arrivee (id, "registreId", "uniteKey", annee, sequence, numero, "dateReception", expediteur, objet, confidentialite, "enregistreParId", "updatedAt")
      SELECT 'vol-c-'||g, '${reg.id}', 'DNPEC', ${an}, 100000 + g, 'VOL/'||g||'/${an}', now() - (g % 300) * interval '1 day', 'Ministère partenaire '||(g % 40),
        'Courrier de volume '||g, 'ORDINAIRE', 'vol-u-1', now()
      FROM generate_series(1,2000) g`);
  }

  // 150 000 notifications et 100 000 lignes d'audit.
  await sql(`
    INSERT INTO notifications (id, "userId", type, channel, title, body, link, "isRead", "sentAt", "createdAt")
    SELECT 'vol-n-'||g, 'vol-u-'||(1 + g % 300), 'TACHE_ASSIGNEE', 'IN_APP', 'Nouvelle tâche', 'Une tâche vous a été assignée : Tâche '||(1 + g % 20000),
      '/tasks/vol-t-'||(1 + g % 20000), g % 3 = 0, now(), now() - (g % 200) * interval '1 hour'
    FROM generate_series(1,150000) g`);
  await sql(`
    INSERT INTO audit_logs (id, action, "entityType", "entityId", "actorId", metadata)
    SELECT 'vol-a-'||g, 'MODIFICATION', 'Task', 'vol-t-'||(1 + g % 20000), 'vol-u-'||(1 + g % 300), jsonb_build_object('event','volume')
    FROM generate_series(1,100000) g`);
  await prisma.$queryRawUnsafe(`SELECT "audit_sceller"(make_interval(secs => 0))`);
  await sql('ANALYZE');
  const taille = await prisma.$queryRawUnsafe(`SELECT pg_size_pretty(pg_database_size(current_database())) AS t`);
  console.log(`Volume créé en ${Math.round((Date.now() - t0) / 1000)} s — base : ${taille[0].t}.`);
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
