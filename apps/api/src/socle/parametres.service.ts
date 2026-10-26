import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditAction, Prisma, SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { AutorisationService } from './autorisation.service';

/**
 * Paramètres de fonctionnement (cahier NIMBA §13.6), branchés sur le circuit qu'ils gouvernent.
 * Bornes contrôlées par le serveur ; chaque modification est auditée. Lecture : administrateur,
 * DN et DNA (annexe 1 : « Paramétrage » L(T) pour la Direction, CLM(T) pour l'administrateur).
 */
export type DefinitionParametre = {
  cle: string;
  libelle: string;
  unite: string;
  defaut: number;
  min: number;
  max: number;
  effet: string;
  reference: string;
  /** Rubrique « indicateurs » : cible d'un indicateur de succès, montrée dans l'onglet de ces indicateurs
   * (pas dans l'onglet « Paramètres »), même circuit de modification. */
  rubrique?: 'indicateurs';
};

export const PARAMETRES: DefinitionParametre[] = [
  {
    cle: 'motDePasse.longueurMin',
    libelle: 'Longueur minimale du mot de passe',
    unite: 'caractères',
    defaut: 8,
    min: 8,
    max: 32,
    effet: 'Demande d’accès, mot de passe choisi ou réinitialisé, mot de passe temporaire.',
    reference: '§4.4 (8 caractères : décision de la Direction)',
  },
  {
    cle: 'connexions.conservationMois',
    libelle: 'Conservation des journaux de connexion',
    unite: 'mois',
    defaut: 12,
    min: 6,
    max: 36,
    effet: 'Purge quotidienne des connexions plus anciennes.',
    reference: 'SOC-SEC-05',
  },
  {
    cle: 'session.expirationJours',
    libelle: 'Expiration de la session après inactivité',
    unite: 'jours',
    defaut: 30,
    min: 1,
    max: 90,
    effet: 'Au-delà, il faut se reconnecter.',
    reference: '§4.4',
  },
  {
    cle: 'conges.delaiAvisHeures',
    libelle: 'Délai d’avis du chef sur une demande de congé',
    unite: 'heures ouvrées',
    defaut: 48,
    min: 12,
    max: 120,
    effet: 'Passé ce délai, l’avis est réputé favorable et la demande va au DRH ; alerte au chef 12 heures ouvrées avant.',
    reference: '§13.6, circuit A6.1',
  },
  {
    cle: 'rh.avancementEchelonMois',
    libelle: 'Ancienneté dans l’échelon avant un avancement à instruire',
    unite: 'mois',
    defaut: 24,
    min: 12,
    max: 60,
    effet: 'Alerte « avancement d’échelon à instruire » au DRH pour un fonctionnaire resté plus longtemps dans son échelon.',
    reference: 'A3.5, SIG-RF-CAR-02',
  },
  {
    cle: 'rh.formationAlerteJours',
    libelle: 'Préavis avant le début d’une formation planifiée',
    unite: 'jours',
    defaut: 15,
    min: 3,
    max: 60,
    effet: 'L’agent et son chef le plus proche sont prévenus, une seule fois, ce nombre de jours avant le début d’une session de formation planifiée.',
    reference: 'Plan de formation individuel',
  },
  {
    cle: 'calcul.tentativesMax',
    libelle: 'Essais auprès du service de calcul avant de le déclarer injoignable',
    unite: 'essais',
    defaut: 10,
    min: 1,
    max: 50,
    effet: 'Un travail (vérification d’un paquet, exécution) est relancé tant que ce nombre n’est pas atteint : le service gratuit s’endort après 15 minutes et se réveille au premier appel.',
    reference: 'Domaine B, lot B1',
  },
  {
    cle: 'calcul.delaiRelanceSecondes',
    libelle: 'Délai entre deux essais auprès du service de calcul',
    unite: 'secondes',
    defaut: 30,
    min: 5,
    max: 600,
    effet: 'Attente avant de relancer un travail quand le service de calcul ne répond pas ou est occupé.',
    reference: 'Domaine B, lot B1',
  },
  {
    cle: 'finPrevue.alerteJours',
    libelle: 'Alerte avant une fin de stage ou de contrat',
    unite: 'jours',
    defaut: 15,
    min: 5,
    max: 60,
    effet: 'Première alerte au DRH ; le rappel reste à 3 jours.',
    reference: '§4.1',
  },
  // Cibles des indicateurs de succès (docs/conception_indicateurs_succes.md) : créées par le paramétrage initial.
  {
    cle: 'indicateurs.cibleConnexionsPct',
    libelle: 'Cible : comptes actifs connectés chaque semaine (4 dernières semaines)',
    unite: '%',
    defaut: 70,
    min: 10,
    max: 100,
    effet: 'Indicateur « Atteint » si la part mesurée est au moins égale à la cible.',
    reference: 'Indicateurs de succès',
    rubrique: 'indicateurs',
  },
  {
    cle: 'indicateurs.cibleDecisionsTachePct',
    libelle: 'Cible : décisions de réunion converties en tâche',
    unite: '%',
    defaut: 60,
    min: 10,
    max: 100,
    effet: 'Indicateur « Atteint » si la part mesurée est au moins égale à la cible.',
    reference: 'Indicateurs de succès',
    rubrique: 'indicateurs',
  },
  {
    cle: 'indicateurs.cibleDelaiCongeJours',
    libelle: 'Cible : délai moyen entre une demande de congé et sa décision',
    unite: 'jours ouvrés',
    defaut: 5,
    min: 1,
    max: 30,
    effet: 'Indicateur « Atteint » si le délai moyen mesuré ne dépasse pas la cible.',
    reference: 'Indicateurs de succès',
    rubrique: 'indicateurs',
  },
  {
    cle: 'indicateurs.cibleImputationsPct',
    libelle: 'Cible : imputations de courrier traitées avant leur échéance',
    unite: '%',
    defaut: 80,
    min: 10,
    max: 100,
    effet: 'Indicateur « Atteint » si la part mesurée est au moins égale à la cible.',
    reference: 'Indicateurs de succès',
    rubrique: 'indicateurs',
  },
  {
    cle: 'indicateurs.cibleTachesPct',
    libelle: 'Cible : tâches terminées dans les délais',
    unite: '%',
    defaut: 75,
    min: 10,
    max: 100,
    effet: 'Indicateur « Atteint » si la part mesurée est au moins égale à la cible.',
    reference: 'Indicateurs de succès',
    rubrique: 'indicateurs',
  },
];

const PAR_CLE = new Map(PARAMETRES.map((p) => [p.cle, p]));
export const CLE_TEST_RESTAURATION = 'supervision.testRestauration';
export type TestRestauration = { date: string; resultat: 'REUSSI' | 'ECHEC'; commentaire: string | null; declarePar: string };

@Injectable()
export class ParametresService {
  private cache: { valeurs: Map<string, Prisma.JsonValue>; lu: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly autorisation: AutorisationService,
  ) {}

  private async valeurs(): Promise<Map<string, Prisma.JsonValue>> {
    if (this.cache && Date.now() - this.cache.lu < 5000) return this.cache.valeurs;
    const lignes = await this.prisma.parametre.findMany();
    this.cache = { valeurs: new Map(lignes.map((l) => [l.cle, l.valeur])), lu: Date.now() };
    return this.cache.valeurs;
  }

  /** Valeur en vigueur (défaut si jamais modifiée, bornée si la base contient une valeur hors bornes). */
  async valeur(cle: string): Promise<number> {
    const def = PAR_CLE.get(cle);
    if (!def) throw new Error(`Paramètre inconnu : ${cle}`);
    const v = (await this.valeurs()).get(cle);
    return typeof v === 'number' && Number.isInteger(v) && v >= def.min && v <= def.max ? v : def.defaut;
  }

  async exigerLongueurMotDePasse(motDePasse: string): Promise<void> {
    const min = await this.valeur('motDePasse.longueurMin');
    if (motDePasse.length < min) throw new BadRequestException(`Le mot de passe doit contenir au moins ${min} caractères.`);
  }

  async exigerLecture(actor: AuthenticatedUser): Promise<void> {
    await this.autorisation.exiger(actor, {
      action: 'L',
      objet: { type: 'Parametre' },
      positionsAcceptees: [SystemRole.ADMIN_SYSTEME, SystemRole.DN, SystemRole.DNA],
      perimetre: 'IGNORE',
    });
  }

  async lister(actor: AuthenticatedUser) {
    await this.exigerLecture(actor);
    const lignes = new Map((await this.prisma.parametre.findMany()).map((l) => [l.cle, l]));
    const peutModifier = actor.role === SystemRole.ADMIN_SYSTEME && !actor.interimForId;
    const auteurs = await this.prisma.user.findMany({
      where: { id: { in: [...lignes.values()].map((l) => l.modifieParId).filter((x): x is string => !!x) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nom = (id: string | null) => {
      const a = auteurs.find((u) => u.id === id);
      return a ? `${a.firstName} ${a.lastName}` : null;
    };
    const test = lignes.get(CLE_TEST_RESTAURATION);
    return {
      droits: { peutModifier },
      parametres: await Promise.all(
        // Les cibles des indicateurs de succès sont dans leur propre onglet (IndicateursSuccesService).
        PARAMETRES.filter((p) => !p.rubrique).map((p) => this.presenter(p, lignes.get(p.cle), nom)),
      ),
      testRestauration: test ? { ...(test.valeur as TestRestauration), declarePar: nom(test.modifieParId) } : null,
    };
  }

  /** Ligne d'un paramètre pour l'écran. Une ligne créée par le paramétrage initial (sans auteur) garde la
   * valeur par défaut : elle n'est pas présentée comme « modifiée ». */
  async presenter(p: DefinitionParametre, l: { modifieParId: string | null; modifieLe: Date } | undefined, nom: (id: string | null) => string | null) {
    const modifie = !!l?.modifieParId;
    return { ...p, valeur: await this.valeur(p.cle), modifie, modifieLe: modifie ? l!.modifieLe : null, modifiePar: modifie ? nom(l!.modifieParId) : null };
  }

  /** Cibles des indicateurs de succès (rubrique « indicateurs »), avec leurs lignes en base. */
  async cibles(): Promise<{ definitions: DefinitionParametre[]; lignes: Map<string, { modifieParId: string | null; modifieLe: Date }> }> {
    const definitions = PARAMETRES.filter((p) => p.rubrique === 'indicateurs');
    const lignes = new Map((await this.prisma.parametre.findMany({ where: { cle: { in: definitions.map((d) => d.cle) } } })).map((l) => [l.cle, l]));
    return { definitions, lignes };
  }

  private async exigerAdministrateur(actor: AuthenticatedUser): Promise<void> {
    await this.autorisation.exiger(actor, {
      action: 'M',
      objet: { type: 'Parametre' },
      positionsAcceptees: [SystemRole.ADMIN_SYSTEME],
      perimetre: 'IGNORE',
    });
  }

  async modifier(actor: AuthenticatedUser, cle: string, valeur: number) {
    await this.exigerAdministrateur(actor);
    const def = PAR_CLE.get(cle);
    if (!def) throw new BadRequestException('Paramètre inconnu.');
    if (!Number.isInteger(valeur) || valeur < def.min || valeur > def.max) {
      throw new BadRequestException(`${def.libelle} : valeur entière entre ${def.min} et ${def.max} ${def.unite}.`);
    }
    const avant = await this.valeur(cle);
    await this.prisma.$transaction(async (tx) => {
      await tx.parametre.upsert({ where: { cle }, create: { cle, valeur, modifieParId: actor.id }, update: { valeur, modifieParId: actor.id } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Parametre', entityId: cle, metadata: { event: 'parametre_modifie', avant, apres: valeur } }, tx);
    });
    this.cache = null;
    return this.lister(actor);
  }

  async declarerTestRestauration(actor: AuthenticatedUser, t: { date: string; resultat: 'REUSSI' | 'ECHEC'; commentaire?: string }) {
    await this.exigerAdministrateur(actor);
    const date = new Date(t.date);
    if (Number.isNaN(+date) || date.getTime() > Date.now() + 864e5) throw new BadRequestException('La date du test ne peut pas être dans le futur.');
    const valeur = { date: t.date.slice(0, 10), resultat: t.resultat, commentaire: t.commentaire?.trim() || null } as Prisma.InputJsonValue;
    await this.prisma.$transaction(async (tx) => {
      await tx.parametre.upsert({ where: { cle: CLE_TEST_RESTAURATION }, create: { cle: CLE_TEST_RESTAURATION, valeur, modifieParId: actor.id }, update: { valeur, modifieParId: actor.id } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Parametre', entityId: CLE_TEST_RESTAURATION, metadata: { event: 'test_restauration_declare', ...(valeur as object) } }, tx);
    });
    this.cache = null;
    return this.lister(actor);
  }
}
