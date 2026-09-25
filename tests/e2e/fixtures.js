// Jeu de données de test (comptes fictifs @test.local, mot de passe commun de test).
// Idempotent : upsert par email/code. Refuse toute base non locale.
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url)) { console.error('REFUS : DATABASE_URL non locale'); process.exit(1); }
const p = new PrismaClient();
(async () => {
  const hash = await argon2.hash('Password123!', { type: argon2.argon2id });
  const dpe = await p.division.upsert({ where: { code: 'DPE' }, update: {}, create: { code: 'DPE', name: 'Division Prévisions' } });
  const dee = await p.division.upsert({ where: { code: 'DEE' }, update: {}, create: { code: 'DEE', name: 'Division Études' } });
  const sec = async (d, code) => (await p.section.findFirst({ where: { divisionId: d.id, code } })) || p.section.create({ data: { divisionId: d.id, code, name: 'Section ' + code } });
  const ssr = await sec(dpe, 'SSR'), sfp = await sec(dpe, 'SFP'), se = await sec(dee, 'SE');
  const saf = await p.cellule.findUnique({ where: { code: 'SAF' } });
  const u = async (key, role, extra = {}) => p.user.upsert({
    where: { email: `${key}@test.local` }, update: { role, status: 'ACTIF', ...extra },
    create: { email: `${key}@test.local`, passwordHash: hash, firstName: key.toUpperCase(), lastName: 'Test', role, status: 'ACTIF', ...extra } });
  const out = {};
  out.dn = await u('dn', 'DN'); out.dna = await u('dna', 'DNA');
  out.admin = await u('admin', 'ADMIN_SYSTEME', { celluleId: (await p.cellule.findUnique({ where: { code: 'CSID' } })).id });
  out.chefdpe = await u('chefdpe', 'CHEF_DIVISION', { divisionId: dpe.id });
  out.chefssr = await u('chefssr', 'CHEF_SECTION', { divisionId: dpe.id, sectionId: ssr.id });
  out.chefsfp = await u('chefsfp', 'CHEF_SECTION', { divisionId: dpe.id, sectionId: sfp.id });
  out.agent1 = await u('agent1', 'AGENT', { divisionId: dpe.id, sectionId: ssr.id });
  out.agent2 = await u('agent2', 'AGENT', { divisionId: dpe.id, sectionId: ssr.id });
  out.chefdee = await u('chefdee', 'CHEF_DIVISION', { divisionId: dee.id });
  out.chefse = await u('chefse', 'CHEF_SECTION', { divisionId: dee.id, sectionId: se.id });
  out.agentdee = await u('agentdee', 'AGENT', { divisionId: dee.id, sectionId: se.id });
  out.chefsaf = await u('chefsaf', 'CHEF_CELLULE', { celluleId: saf.id });
  await p.cellule.update({ where: { id: saf.id }, data: { chefId: out.chefsaf.id } });
  out.agentsaf = await u('agentsaf', 'AGENT', { celluleId: saf.id });
  out.assdn = await u('assdn', 'ASSISTANT_DIRECTION', { supervisorId: out.dn.id });
  out.drh = await u('drh', 'DRH');
  out.secdg = await u('secdg', 'AGENT', { celluleId: saf.id });
  out.secdpe = await u('secdpe', 'AGENT', { divisionId: dpe.id, sectionId: sfp.id });
  out.asssaf = await u('asssaf', 'ASSISTANT_DIRECTION', { supervisorId: out.chefsaf.id });
  const ids = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.id]));
  Object.assign(ids, { DPE: dpe.id, DEE: dee.id, SSR: ssr.id, SFP: sfp.id, SE: se.id, SAF: saf.id });
  require('fs').writeFileSync(require('./config').etat('ids.json'), JSON.stringify(ids, null, 1));
  console.log(ids);
  await p.$disconnect();
})();
