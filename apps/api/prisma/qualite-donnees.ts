/**
 * Rapport de qualité des données — LECTURE SEULE (formation et démarrage réel, octobre 2026).
 *
 *   pnpm --filter @dnpec/api run db:qualite                 # base locale, avec les noms
 *   pnpm --filter @dnpec/api run db:qualite -- --sans-noms  # chiffres seulement (workflow GitHub)
 *
 * Toutes les lectures se font dans UNE transaction déclarée `READ ONLY` : PostgreSQL refuse alors
 * toute écriture, même par erreur. Le rapport (Markdown) sort sur la sortie standard. Avec
 * `--sans-noms`, il ne contient que des nombres (aucune donnée personnelle dans les journaux du
 * workflow `db-qualite.yml`). Jamais de donnée protégée (niveau 2 du dossier, motif médical).
 */
import { PrismaClient, StatutAgent, SystemRole, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();
const SANS_NOMS = process.argv.includes('--sans-noms');
const MAX = 50;
const JOUR = 864e5;

type Ligne = { nom: string; detail?: string };
type Rubrique = { titre: string; action: string; nombre: number; lignes: Ligne[] };

async function rapport(): Promise<Rubrique[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const actifs = { statut: { not: StatutAgent.PARTI } };
    const nomAgent = (a: { nom: string; prenoms: string; matricule: string }) => ({ nom: `${a.prenoms} ${a.nom}`, detail: `matricule ${a.matricule}` });
    const nomCompte = (u: { firstName: string; lastName: string; email: string }) => ({ nom: `${u.firstName} ${u.lastName}`, detail: u.email });
    const r: Rubrique[] = [];

    // 1. Agents sans unité.
    const sansUnite = await tx.agent.findMany({ where: { ...actifs, uniteId: null }, select: { nom: true, prenoms: true, matricule: true }, orderBy: { nom: 'asc' } });
    r.push({ titre: 'Agents sans unité', action: 'Personnel → « Agents » → fiche de l’agent → « Modifier » → unité (DRH).', nombre: sansUnite.length, lignes: sansUnite.map(nomAgent) });

    // 2. Unités sans chef.
    const unites = await tx.uniteOrganisationnelle.findMany({ where: { dateFermeture: null, responsableId: null, NOT: { type: 'DIRECTION' } }, select: { code: true, libelle: true, type: true }, orderBy: { code: 'asc' } });
    r.push({ titre: 'Unités sans chef désigné', action: 'Utilisateurs → « Gérer » → « Changer de rôle » vers le rôle de chef de l’unité (administrateur) ; Organisation pour une cellule.', nombre: unites.length, lignes: unites.map((u) => ({ nom: `${u.code} — ${u.libelle}`, detail: u.type.toLowerCase() })) });

    // 3. Chefs en double sur une même unité.
    const parDivision = await tx.user.groupBy({ by: ['divisionId'], where: { role: SystemRole.CHEF_DIVISION, status: UserStatus.ACTIF, divisionId: { not: null } }, _count: { _all: true } });
    const parSection = await tx.user.groupBy({ by: ['sectionId'], where: { role: SystemRole.CHEF_SECTION, status: UserStatus.ACTIF, sectionId: { not: null } }, _count: { _all: true } });
    const doublons = [...parDivision.filter((c) => c._count._all > 1).map((c) => `division ${c.divisionId}`), ...parSection.filter((c) => c._count._all > 1).map((c) => `section ${c.sectionId}`)];
    r.push({ titre: 'Unités avec deux chefs actifs', action: 'Utilisateurs : retirer le rôle de chef à l’un des deux (changement de rôle).', nombre: doublons.length, lignes: doublons.map((d) => ({ nom: d })) });

    // 4. Matricules provisoires.
    const provisoires = await tx.agent.findMany({ where: { ...actifs, matriculeProvisoire: true }, select: { nom: true, prenoms: true, matricule: true }, orderBy: { nom: 'asc' } });
    r.push({ titre: 'Matricules provisoires à remplacer', action: 'Personnel → « Agents » → fiche de l’agent → saisir le matricule définitif (DRH).', nombre: provisoires.length, lignes: provisoires.map(nomAgent) });

    // 5. Dossiers incomplets (pièces requises, socle N6).
    const pieces = await tx.pieceRequise.findMany({ where: { actif: true }, select: { id: true, libelle: true } });
    const comptes = await tx.user.findMany({
      where: { status: UserStatus.ACTIF, role: { notIn: [SystemRole.STAGIAIRE, SystemRole.ADMIN_SYSTEME] } },
      select: { firstName: true, lastName: true, email: true, personnelDocuments: { where: { pieceRequiseId: { not: null } }, select: { pieceRequiseId: true } } },
      orderBy: { lastName: 'asc' },
    });
    const incomplets = comptes
      .map((u) => ({ u, manque: pieces.filter((p) => !u.personnelDocuments.some((d) => d.pieceRequiseId === p.id)).map((p) => p.libelle) }))
      .filter((x) => x.manque.length > 0);
    r.push({ titre: `Dossiers incomplets (${pieces.length} pièce(s) requise(s))`, action: 'Ressources humaines → Alertes : déposer les pièces manquantes dans chaque dossier (DRH).', nombre: incomplets.length, lignes: incomplets.map((x) => ({ ...nomCompte(x.u), detail: `manque : ${x.manque.join(', ')}` })) });

    // 6. Dossiers « à vérifier » (champs non confirmés par l'agent).
    const fiches = await tx.personnelFileBasic.findMany({ where: { user: { status: UserStatus.ACTIF } }, select: { verifiedFields: true, user: { select: { firstName: true, lastName: true, email: true } } } });
    const aVerifier = fiches.filter((f) => Object.values((f.verifiedFields ?? {}) as Record<string, boolean>).some((v) => v === false));
    r.push({ titre: 'Dossiers avec des informations « à vérifier »', action: 'Chaque agent ouvre « Mon dossier » et clique sur « Confirmer mes informations » (ou signale une erreur).', nombre: aVerifier.length, lignes: aVerifier.map((f) => nomCompte(f.user)) });

    // 7. Comptes inactifs.
    const il90 = new Date(Date.now() - 90 * JOUR);
    const il7 = new Date(Date.now() - 7 * JOUR);
    const jamais = await tx.user.findMany({ where: { status: UserStatus.ACTIF, createdAt: { lt: il7 }, sessions: { none: {} } }, select: { firstName: true, lastName: true, email: true }, orderBy: { lastName: 'asc' } });
    const inactifs = await tx.user.findMany({ where: { status: UserStatus.ACTIF, sessions: { some: {} }, NOT: { sessions: { some: { lastUsedAt: { gte: il90 } } } } }, select: { firstName: true, lastName: true, email: true }, orderBy: { lastName: 'asc' } });
    r.push({ titre: 'Comptes actifs jamais utilisés (créés il y a plus de 7 jours)', action: 'Relancer la personne, ou suspendre le compte (Utilisateurs).', nombre: jamais.length, lignes: jamais.map(nomCompte) });
    r.push({ titre: 'Comptes sans connexion depuis 90 jours', action: 'Vérifier que la personne est toujours en poste ; sinon, départ de l’agent (DRH) ou suspension (administrateur).', nombre: inactifs.length, lignes: inactifs.map(nomCompte) });
    const attente = await tx.user.count({ where: { status: UserStatus.EN_ATTENTE } });
    r.push({ titre: 'Inscriptions en attente', action: 'Utilisateurs → « Inscriptions en attente » : approuver ou rejeter.', nombre: attente, lignes: [] });

    // 8. Calendrier des jours fériés.
    const an = new Date().getUTCFullYear();
    const compte = async (a: number) => tx.jourFerie.count({ where: { date: { gte: new Date(Date.UTC(a, 0, 1)), lt: new Date(Date.UTC(a + 1, 0, 1)) } } });
    const parAn = new Map([[an, await compte(an)], [an + 1, await compte(an + 1)]]);
    const nb = (a: number) => parAn.get(a) ?? 0;
    const manque = [an, an + 1].filter((a) => nb(a) === 0);
    r.push({ titre: 'Années sans jour férié saisi', action: 'Personnel → « Congés & absences » → onglet « Jours fériés » : ajouter les fêtes religieuses (dates variables) de l’année (DRH ou administrateur).', nombre: manque.length, lignes: [an, an + 1].map((a) => ({ nom: String(a), detail: `${nb(a)} jour(s) férié(s)` })) });

    // 9. Familles d'actes RH sans registre (socle N6).
    const familles = await tx.familleActeRh.findMany({ where: { registreId: null }, select: { libelle: true } });
    r.push({ titre: 'Familles d’actes RH sans registre du Courrier', action: 'Ressources humaines → Carrière et actes → Familles d’actes : choisir un registre (DRH).', nombre: familles.length, lignes: familles.map((f) => ({ nom: f.libelle })) });

    return r;
  }, { timeout: 60_000 });
}

function markdown(r: Rubrique[]): string {
  const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const out = [`# Qualité des données — ${date} UTC`, '', `Lecture seule. ${SANS_NOMS ? 'Chiffres seulement (sans noms).' : `Au plus ${MAX} noms par rubrique.`}`, '', '| Rubrique | Nombre | À faire |', '|---|---|---|'];
  for (const x of r) out.push(`| ${x.titre} | **${x.nombre}** | ${x.action} |`);
  if (!SANS_NOMS) {
    for (const x of r.filter((y) => y.lignes.length)) {
      out.push('', `## ${x.titre} (${x.nombre})`, '');
      for (const l of x.lignes.slice(0, MAX)) out.push(`- ${l.nom}${l.detail ? ` — ${l.detail}` : ''}`);
      if (x.lignes.length > MAX) out.push(`- … et ${x.lignes.length - MAX} autre(s)`);
    }
  }
  return out.join('\n') + '\n';
}

rapport()
  .then((r) => process.stdout.write(markdown(r)))
  .catch((e) => {
    console.error(`Rapport impossible : ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
