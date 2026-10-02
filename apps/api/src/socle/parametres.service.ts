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
    cle: 'finPrevue.alerteJours',
    libelle: 'Alerte avant une fin de stage ou de contrat',
    unite: 'jours',
    defaut: 15,
    min: 5,
    max: 60,
    effet: 'Première alerte au DRH ; le rappel reste à 3 jours.',
    reference: '§4.1',
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

  private async exigerLecture(actor: AuthenticatedUser): Promise<void> {
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
        PARAMETRES.map(async (p) => {
          const l = lignes.get(p.cle);
          return { ...p, valeur: await this.valeur(p.cle), modifie: !!l, modifieLe: l?.modifieLe ?? null, modifiePar: l ? nom(l.modifieParId) : null };
        }),
      ),
      testRestauration: test ? { ...(test.valeur as TestRestauration), declarePar: nom(test.modifieParId) } : null,
    };
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
