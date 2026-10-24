import { Injectable } from '@nestjs/common';
import { Prisma, SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ParametresService } from './parametres.service';
import { JoursFeriesService } from './jours-feries.service';
import { heuresOuvreesEntre } from './heures-ouvrees';

const JOUR = 864e5;
const SEMAINE = 7 * JOUR;
/** Comptes de démonstration (prisma/demo.ts) : jamais comptés. */
const DOMAINE_DEMO = '%@demo.dnpec.test';

type Sens = 'MIN' | 'MAX';
export type Indicateur = {
  cle: string;
  libelle: string;
  valeur: number | null;
  unite: string;
  cible: number;
  cleCible: string;
  sens: Sens;
  atteint: boolean | null;
  periode: string;
  base: number;
};

const dateFr = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const pct = (n: number, sur: number) => (sur > 0 ? Math.round((1000 * n) / sur) / 10 : null);

/**
 * Indicateurs de succès (onglet de « Paramétrage et supervision », docs/conception_indicateurs_succes.md) :
 * calculés à la lecture à partir des données réelles, rien n'est stocké ; seules les cibles sont des
 * paramètres bornés (`ParametresService`, rubrique « indicateurs »). Lecture : administrateur, DN, DNA
 * (mêmes règles que les paramètres) ; modification d'une cible : administrateur (route des paramètres).
 */
@Injectable()
export class IndicateursSuccesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametres: ParametresService,
    private readonly feries: JoursFeriesService,
  ) {}

  async lire(actor: AuthenticatedUser, maintenant = new Date()) {
    await this.parametres.exigerLecture(actor);
    const un_an = new Date(maintenant.getTime() - 365 * JOUR);
    const cibles = await this.parametres.cibles();
    const cible = async (cle: string) => this.parametres.valeur(cle);
    const indicateur = async (i: Omit<Indicateur, 'cible' | 'atteint'>): Promise<Indicateur> => {
      const c = await cible(i.cleCible);
      return { ...i, cible: c, atteint: i.valeur === null ? null : i.sens === 'MIN' ? i.valeur >= c : i.valeur <= c };
    };
    const periodeAn = `Du ${dateFr(un_an)} au ${dateFr(maintenant)}`;

    const [connexions, decisions, conges, imputations, taches] = await Promise.all([
      this.connexions(maintenant),
      this.prisma.$queryRaw<{ total: number; converties: number }[]>(Prisma.sql`
        SELECT count(*)::int AS total, count(t.id)::int AS converties
        FROM decisions d LEFT JOIN tasks t ON t."sourceDecisionId" = d.id
        WHERE d."createdAt" >= ${un_an} AND d."createdAt" <= ${maintenant}`),
      this.delaiConges(un_an, maintenant),
      this.prisma.$queryRaw<{ total: number; aTemps: number }[]>(Prisma.sql`
        SELECT count(*)::int AS total, count(*) FILTER (WHERE i."traiteeAt" IS NOT NULL AND i."traiteeAt" <= i.echeance)::int AS "aTemps"
        FROM imputations_courrier i
        WHERE i.echeance IS NOT NULL AND i.echeance >= ${un_an} AND i.echeance <= ${maintenant}`),
      this.prisma.$queryRaw<{ total: number; aTemps: number }[]>(Prisma.sql`
        SELECT count(*)::int AS total, count(*) FILTER (WHERE (t."completedAt" AT TIME ZONE 'UTC')::date <= (t."dueDate" AT TIME ZONE 'UTC')::date)::int AS "aTemps"
        FROM tasks t
        WHERE t."parentTaskId" IS NULL AND t."dueDate" IS NOT NULL AND t."completedAt" IS NOT NULL
          AND t.status IN ('TERMINEE', 'VALIDEE') AND t."completedAt" >= ${un_an} AND t."completedAt" <= ${maintenant}`),
    ]);

    const indicateurs = await Promise.all([
      indicateur({
        cle: 'connexionsHebdomadaires',
        libelle: 'Comptes actifs connectés au moins une fois par semaine (4 dernières semaines)',
        valeur: connexions.valeur,
        unite: '%',
        cleCible: 'indicateurs.cibleConnexionsPct',
        sens: 'MIN',
        periode: connexions.periode,
        base: connexions.base,
      }),
      indicateur({
        cle: 'decisionsEnTache',
        libelle: 'Décisions de réunion converties en tâche',
        valeur: pct(decisions[0]!.converties, decisions[0]!.total),
        unite: '%',
        cleCible: 'indicateurs.cibleDecisionsTachePct',
        sens: 'MIN',
        periode: periodeAn,
        base: decisions[0]!.total,
      }),
      indicateur({
        cle: 'delaiDecisionConge',
        libelle: 'Délai moyen entre une demande de congé et sa décision',
        valeur: conges.valeur,
        unite: 'jours ouvrés',
        cleCible: 'indicateurs.cibleDelaiCongeJours',
        sens: 'MAX',
        periode: `Décisions du ${dateFr(un_an)} au ${dateFr(maintenant)}`,
        base: conges.base,
      }),
      indicateur({
        // Un courrier arrivé n'a pas d'échéance : seule l'imputation en porte une (voir la note de conception).
        cle: 'imputationsDansLesDelais',
        libelle: 'Imputations de courrier traitées avant leur échéance',
        valeur: pct(imputations[0]!.aTemps, imputations[0]!.total),
        unite: '%',
        cleCible: 'indicateurs.cibleImputationsPct',
        sens: 'MIN',
        periode: `Échéances du ${dateFr(un_an)} au ${dateFr(maintenant)}`,
        base: imputations[0]!.total,
      }),
      indicateur({
        cle: 'tachesDansLesDelais',
        libelle: 'Tâches terminées dans les délais',
        valeur: pct(taches[0]!.aTemps, taches[0]!.total),
        unite: '%',
        cleCible: 'indicateurs.cibleTachesPct',
        sens: 'MIN',
        periode: `Tâches terminées du ${dateFr(un_an)} au ${dateFr(maintenant)}`,
        base: taches[0]!.total,
      }),
    ]);

    const nom = await this.noms([...cibles.lignes.values()].map((l) => l.modifieParId));
    return {
      droits: { peutModifier: actor.role === SystemRole.ADMIN_SYSTEME && !actor.interimForId },
      calculeLe: maintenant,
      indicateurs,
      cibles: await Promise.all(cibles.definitions.map((d) => this.parametres.presenter(d, cibles.lignes.get(d.cle), nom))),
    };
  }

  private async noms(ids: (string | null)[]) {
    const l = await this.prisma.user.findMany({ where: { id: { in: ids.filter((x): x is string => !!x) } }, select: { id: true, firstName: true, lastName: true } });
    return (id: string | null) => {
      const u = l.find((x) => x.id === id);
      return u ? `${u.firstName} ${u.lastName}` : null;
    };
  }

  /**
   * Comptes actifs connectés (connexion réussie) dans chacune des 4 dernières semaines glissantes. Le journal
   * des connexions est purgé (`connexions.conservationMois`, au moins 6 mois) : si sa plus ancienne ligne est
   * plus récente que le début de la fenêtre (mise en service), seules les semaines entièrement couvertes sont
   * exigées et la période le dit.
   */
  private async connexions(maintenant: Date): Promise<{ valeur: number | null; periode: string; base: number }> {
    const debutFenetre = new Date(maintenant.getTime() - 4 * SEMAINE);
    const plusAncienne = (await this.prisma.journalConnexion.aggregate({ _min: { createdAt: true } }))._min.createdAt;
    const semaines = plusAncienne && plusAncienne > debutFenetre ? Math.floor((maintenant.getTime() - plusAncienne.getTime()) / SEMAINE) : 4;
    const actifs = (await this.prisma.$queryRaw<{ n: number }[]>(Prisma.sql`SELECT count(*)::int AS n FROM users WHERE status = 'ACTIF' AND email NOT LIKE ${DOMAINE_DEMO}`))[0]!.n;
    if (semaines < 1) return { valeur: null, periode: 'Journal des connexions plus récent qu’une semaine : non mesurable', base: actifs };
    const debut = new Date(maintenant.getTime() - semaines * SEMAINE);
    const reguliers = (
      await this.prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
        SELECT count(*)::int AS n FROM (
          SELECT j."userId"
          FROM journal_connexions j JOIN users u ON u.id = j."userId"
          WHERE j.resultat = 'SUCCES' AND j."createdAt" > ${debut} AND j."createdAt" <= ${maintenant}
            AND u.status = 'ACTIF' AND u.email NOT LIKE ${DOMAINE_DEMO}
          GROUP BY j."userId"
          HAVING count(DISTINCT floor(extract(epoch FROM (${maintenant}::timestamp - j."createdAt")) / ${SEMAINE / 1000})) = ${semaines}
        ) r`)
    )[0]!.n;
    const periode = semaines === 4 ? `Du ${dateFr(debut)} au ${dateFr(maintenant)} (4 semaines)` : `Du ${dateFr(debut)} au ${dateFr(maintenant)} (${semaines} semaine${semaines > 1 ? 's' : ''} : journal des connexions plus récent)`;
    return { valeur: pct(reguliers, actifs), periode, base: actifs };
  }

  /** Délai moyen demande → décision des congés décidés sur la période, en jours ouvrés (24 heures ouvrées). */
  private async delaiConges(debut: Date, fin: Date): Promise<{ valeur: number | null; base: number }> {
    const l = await this.prisma.leaveRequest.findMany({
      where: { status: { in: ['APPROUVEE', 'REJETEE'] }, decidedAt: { gte: debut, lte: fin } },
      select: { createdAt: true, decidedAt: true },
    });
    if (!l.length) return { valeur: null, base: 0 };
    const plusTot = l.reduce((m, r) => (r.createdAt < m ? r.createdAt : m), l[0]!.createdAt);
    const feries = await this.feries.ensemble(plusTot, fin);
    const total = l.reduce((s, r) => s + heuresOuvreesEntre(r.createdAt, r.decidedAt!, feries) / 24, 0);
    return { valeur: Math.round((10 * total) / l.length) / 10, base: l.length };
  }
}
