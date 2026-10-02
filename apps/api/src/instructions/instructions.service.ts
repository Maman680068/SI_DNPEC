import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ActeStatut, AuditAction, NotificationType, Prisma, StatutInstruction, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { TachesPlanifieesService } from '../socle/taches-planifiees.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ExecutionDto, InstructionDto, RejetDto } from './dto/instruction.dto';

const J = 864e5;
const PERSONNE = { select: { id: true, firstName: true, lastName: true } } as const;
const SELECT = {
  id: true,
  objet: true,
  texte: true,
  emetteurId: true,
  emetteur: PERSONNE,
  destinataireId: true,
  destinataire: PERSONNE,
  agentConcerneId: true,
  agentConcerne: PERSONNE,
  echeance: true,
  statut: true,
  emiseLe: true,
  recueLe: true,
  priseEnCompteLe: true,
  executeeLe: true,
  rejeteeLe: true,
  motifRejet: true,
  compteRendu: true,
  acteId: true,
  relanceLe: true,
} satisfies Prisma.InstructionSelect;
type InstructionChargee = Prisma.InstructionGetPayload<{ select: typeof SELECT }>;
const OUVERTS: StatutInstruction[] = [StatutInstruction.EMISE, StatutInstruction.RECUE, StatutInstruction.PRISE_EN_COMPTE];
const LIEN = (id: string) => `/instructions?id=${id}`;
const nom = (p: { firstName: string; lastName: string } | null) => (p ? `${p.firstName} ${p.lastName}` : null);
const signe = (s: ActeStatut) => s === ActeStatut.SIGNE || s === ActeStatut.EXPEDIE;

/**
 * Instructions de la Direction (socle N5, SIG-RF-INS) : émises par le DN ou la DNA seulement, cycle
 * Émise → Reçue → Prise en compte → Exécutée / Rejetée. Invisible pour l'agent concerné tant qu'elle
 * n'est pas exécutée (ni liste, ni fiche, ni notification). Relance au destinataire tous les 7 jours
 * tant qu'elle reste ouverte. Une instruction qui concerne un agent s'exécute par un acte signé du
 * module Courrier dont il est bénéficiaire (acte RH ; la branche paie viendra avec D5).
 */
@Injectable()
export class InstructionsService {
  private readonly logger = new Logger('Instructions');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly taches: TachesPlanifieesService,
  ) {}

  private direction(actor: AuthenticatedUser) {
    return actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
  }

  /** Lecture : émetteur, DN/DNA, destinataire ; agent concerné seulement après exécution. */
  private peutLire(actor: AuthenticatedUser, i: InstructionChargee) {
    if (this.direction(actor) || i.emetteurId === actor.id || i.destinataireId === actor.id) return true;
    return i.agentConcerneId === actor.id && i.statut === StatutInstruction.EXECUTEE;
  }

  private vue(actor: AuthenticatedUser, i: InstructionChargee) {
    const destinataire = i.destinataireId === actor.id;
    const concerneSeulement = i.agentConcerneId === actor.id && !destinataire && !this.direction(actor) && i.emetteurId !== actor.id;
    return {
      id: i.id,
      objet: i.objet,
      texte: i.texte,
      emetteur: { id: i.emetteurId, nom: nom(i.emetteur) },
      destinataire: { id: i.destinataireId, nom: nom(i.destinataire) },
      agentConcerne: i.agentConcerneId ? { id: i.agentConcerneId, nom: nom(i.agentConcerne) } : null,
      echeance: i.echeance,
      statut: i.statut,
      emiseLe: i.emiseLe,
      recueLe: i.recueLe,
      priseEnCompteLe: i.priseEnCompteLe,
      executeeLe: i.executeeLe,
      rejeteeLe: i.rejeteeLe,
      motifRejet: concerneSeulement ? null : i.motifRejet,
      compteRendu: i.compteRendu,
      acteId: i.acteId,
      enRetard: !!i.echeance && OUVERTS.includes(i.statut) && i.echeance < new Date(new Date().toISOString().slice(0, 10)),
      droits: {
        prendreEnCompte: destinataire && (i.statut === StatutInstruction.EMISE || i.statut === StatutInstruction.RECUE),
        executer: destinataire && i.statut === StatutInstruction.PRISE_EN_COMPTE,
        rejeter: destinataire && OUVERTS.includes(i.statut),
        acteRequis: !!i.agentConcerneId,
      },
    };
  }

  async emettre(actor: AuthenticatedUser, dto: InstructionDto) {
    if (!this.direction(actor)) throw new ForbiddenException('Seuls le DN et la DNA émettent des instructions.');
    const dest = await this.prisma.user.findUnique({ where: { id: dto.destinataireId }, select: { id: true, status: true, role: true } });
    if (!dest || dest.status !== UserStatus.ACTIF || dest.role === SystemRole.STAGIAIRE) throw new BadRequestException('Destinataire introuvable ou inactif.');
    if (dest.id === actor.id) throw new BadRequestException('On ne s’adresse pas une instruction à soi-même.');
    if (dto.agentConcerneId) {
      if (dto.agentConcerneId === dto.destinataireId) throw new BadRequestException('L’agent concerné ne peut pas être le destinataire.');
      const a = await this.prisma.user.findUnique({ where: { id: dto.agentConcerneId }, select: { id: true } });
      if (!a) throw new BadRequestException('Agent concerné introuvable.');
    }
    const i = await this.prisma.instruction.create({
      data: {
        objet: dto.objet.trim(),
        texte: dto.texte.trim(),
        emetteurId: actor.id,
        destinataireId: dto.destinataireId,
        agentConcerneId: dto.agentConcerneId ?? null,
        echeance: dto.echeance ? new Date(`${dto.echeance.slice(0, 10)}T00:00:00.000Z`) : null,
      },
      select: SELECT,
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'Instruction', entityId: i.id, metadata: { destinataireId: i.destinataireId, agentConcerne: !!i.agentConcerneId } });
    await this.notifications.notify(i.destinataireId, NotificationType.DECISION_RELANCE, 'Instruction de la Direction', i.objet, LIEN(i.id), undefined, { libelleBouton: 'Voir l’instruction', urgent: true });
    return this.vue(actor, i);
  }

  async liste(actor: AuthenticatedUser) {
    const [emises, recues, meConcernant] = await Promise.all([
      this.direction(actor) ? this.prisma.instruction.findMany({ select: SELECT, orderBy: { emiseLe: 'desc' }, take: 300 }) : this.prisma.instruction.findMany({ where: { emetteurId: actor.id }, select: SELECT, orderBy: { emiseLe: 'desc' } }),
      this.prisma.instruction.findMany({ where: { destinataireId: actor.id }, select: SELECT, orderBy: { emiseLe: 'desc' }, take: 300 }),
      // Invisible pour l'agent concerné avant l'exécution.
      this.prisma.instruction.findMany({ where: { agentConcerneId: actor.id, statut: StatutInstruction.EXECUTEE }, select: SELECT, orderBy: { executeeLe: 'desc' } }),
    ]);
    const peutEmettre = this.direction(actor);
    return {
      peutEmettre,
      // Choix de l'écran d'émission : comptes actifs hors stagiaires, sauf soi-même.
      personnesPossibles: peutEmettre
        ? (await this.prisma.user.findMany({ where: { status: UserStatus.ACTIF, role: { not: SystemRole.STAGIAIRE }, id: { not: actor.id } }, select: { id: true, firstName: true, lastName: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] })).map((u) => ({ id: u.id, nom: nom(u)! }))
        : [],
      emises: emises.map((i) => this.vue(actor, i)),
      recues: recues.map((i) => this.vue(actor, i)),
      meConcernant: meConcernant.map((i) => this.vue(actor, i)),
    };
  }

  /** Ouverture par le destinataire : Émise → Reçue (horodatée). */
  async lire(actor: AuthenticatedUser, id: string) {
    let i = await this.charger(id);
    if (!this.peutLire(actor, i)) throw new NotFoundException('Instruction introuvable');
    if (i.destinataireId === actor.id && i.statut === StatutInstruction.EMISE) {
      await this.prisma.instruction.updateMany({ where: { id, statut: StatutInstruction.EMISE }, data: { statut: StatutInstruction.RECUE, recueLe: new Date() } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Instruction', entityId: id, metadata: { event: 'recue' } });
      i = await this.charger(id);
    }
    const vue = this.vue(actor, i);
    // Exécution d'une instruction RH : actes signés dont l'agent concerné est bénéficiaire, rédigés par le destinataire.
    const actesPossibles =
      vue.droits.executer && i.agentConcerneId
        ? (
            await this.prisma.acteCourrier.findMany({
              where: { beneficiaireId: i.agentConcerneId, redacteurId: actor.id, statut: { in: [ActeStatut.SIGNE, ActeStatut.EXPEDIE] } },
              select: { id: true, numero: true, objet: true },
              orderBy: { updatedAt: 'desc' },
              take: 50,
            })
          ).map((a) => ({ id: a.id, libelle: `${a.numero ?? ''} — ${a.objet}` }))
        : [];
    return { ...vue, actesPossibles };
  }

  async prendreEnCompte(actor: AuthenticatedUser, id: string) {
    const i = await this.pourDestinataire(actor, id, [StatutInstruction.EMISE, StatutInstruction.RECUE]);
    const maintenant = new Date();
    await this.transition(id, i.statut, { statut: StatutInstruction.PRISE_EN_COMPTE, priseEnCompteLe: maintenant, recueLe: i.recueLe ?? maintenant });
    await this.audit.log({ actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'Instruction', entityId: id, metadata: { event: 'prise_en_compte' } });
    await this.notifications.notify(i.emetteurId, NotificationType.DECISION_RELANCE, 'Instruction prise en compte', `${nom(i.destinataire)} : « ${i.objet} »`, LIEN(id), undefined, { libelleBouton: 'Voir l’instruction' });
    return this.vue(actor, await this.charger(id));
  }

  async executer(actor: AuthenticatedUser, id: string, dto: ExecutionDto) {
    const i = await this.pourDestinataire(actor, id, [StatutInstruction.PRISE_EN_COMPTE]);
    if (i.agentConcerneId) {
      if (!dto.acteId) throw new BadRequestException('Une instruction qui concerne un agent s’exécute par un acte signé (module Courrier).');
      const acte = await this.prisma.acteCourrier.findUnique({ where: { id: dto.acteId }, select: { statut: true, beneficiaireId: true } });
      if (!acte) throw new NotFoundException('Acte introuvable');
      if (!signe(acte.statut)) throw new ConflictException('L’acte doit être signé avant l’exécution de l’instruction.');
      if (acte.beneficiaireId !== i.agentConcerneId) throw new BadRequestException('L’acte doit avoir pour bénéficiaire l’agent concerné par l’instruction.');
    }
    await this.transition(id, i.statut, { statut: StatutInstruction.EXECUTEE, executeeLe: new Date(), compteRendu: dto.compteRendu.trim(), acteId: dto.acteId ?? null });
    await this.audit.log({ actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'Instruction', entityId: id, metadata: { event: 'executee', acteId: dto.acteId ?? null } });
    await this.notifications.notify(i.emetteurId, NotificationType.DECISION_RELANCE, 'Instruction exécutée', `${nom(i.destinataire)} : « ${i.objet} »`, LIEN(id), undefined, { libelleBouton: 'Voir l’instruction' });
    if (i.agentConcerneId) {
      await this.notifications.notify(i.agentConcerneId, NotificationType.DECISION_RELANCE, 'Instruction de la Direction vous concernant', `« ${i.objet} » : exécutée.`, LIEN(id), undefined, { libelleBouton: 'Voir l’instruction' });
    }
    return this.vue(actor, await this.charger(id));
  }

  async rejeter(actor: AuthenticatedUser, id: string, dto: RejetDto) {
    const i = await this.pourDestinataire(actor, id, OUVERTS);
    await this.transition(id, i.statut, { statut: StatutInstruction.REJETEE, rejeteeLe: new Date(), motifRejet: dto.motif.trim() });
    await this.audit.log({ actorId: actor.id, action: AuditAction.REJET, entityType: 'Instruction', entityId: id, metadata: { event: 'rejetee' } });
    await this.notifications.notify(i.emetteurId, NotificationType.DECISION_RELANCE, 'Instruction rejetée', `${nom(i.destinataire)} : « ${i.objet} » — ${dto.motif.trim()}`, LIEN(id), undefined, { libelleBouton: 'Voir l’instruction', urgent: true });
    return this.vue(actor, await this.charger(id));
  }

  // ------------------------------------------------------------------ relance à 7 jours

  @Cron('5 7 * * *')
  async quotidien(): Promise<void> {
    await this.taches.suivre('relance-instructions', () => this.relancer(new Date())).catch((e) => this.logger.error(`Relance des instructions : ${e instanceof Error ? e.message : e}`));
  }

  /** Instructions ouvertes sans relance depuis 7 jours (ou depuis l'émission) : relance au destinataire, information à l'émetteur. */
  async relancer(maintenant: Date): Promise<{ relances: number }> {
    const seuil = new Date(maintenant.getTime() - 7 * J);
    const aRelancer = await this.prisma.instruction.findMany({
      where: { statut: { in: OUVERTS }, OR: [{ relanceLe: { lte: seuil } }, { relanceLe: null, emiseLe: { lte: seuil } }] },
      select: SELECT,
    });
    let relances = 0;
    for (const i of aRelancer) {
      const n = await this.prisma.instruction.updateMany({ where: { id: i.id, relanceLe: i.relanceLe }, data: { relanceLe: maintenant } });
      if (!n.count) continue;
      const jours = Math.floor((maintenant.getTime() - i.emiseLe.getTime()) / J);
      await this.notifications.notify(i.destinataireId, NotificationType.DECISION_RELANCE, 'Relance : instruction de la Direction en attente', `« ${i.objet} », émise il y a ${jours} jours.`, LIEN(i.id), undefined, { libelleBouton: 'Voir l’instruction', urgent: true });
      await this.notifications.notify(i.emetteurId, NotificationType.DECISION_RELANCE, 'Instruction toujours en attente', `${nom(i.destinataire)} : « ${i.objet} » (${jours} jours).`, LIEN(i.id), undefined, { libelleBouton: 'Voir l’instruction' });
      await this.audit.log({ actorId: null, action: AuditAction.MODIFICATION, entityType: 'Instruction', entityId: i.id, metadata: { event: 'relance', jours } });
      relances++;
    }
    return { relances };
  }

  // ------------------------------------------------------------------ interne

  private async charger(id: string): Promise<InstructionChargee> {
    const i = await this.prisma.instruction.findUnique({ where: { id }, select: SELECT });
    if (!i) throw new NotFoundException('Instruction introuvable');
    return i;
  }

  private async pourDestinataire(actor: AuthenticatedUser, id: string, statuts: StatutInstruction[]) {
    const i = await this.charger(id);
    if (!this.peutLire(actor, i)) throw new NotFoundException('Instruction introuvable');
    if (i.destinataireId !== actor.id) throw new ForbiddenException('Seul le destinataire traite l’instruction.');
    if (!statuts.includes(i.statut)) throw new ConflictException('Cette action n’est plus possible à ce stade de l’instruction.');
    return i;
  }

  private async transition(id: string, de: StatutInstruction, data: Prisma.InstructionUpdateManyMutationInput) {
    const n = await this.prisma.instruction.updateMany({ where: { id, statut: de }, data });
    if (!n.count) throw new ConflictException('L’instruction vient de changer : rechargez-la.');
  }
}
