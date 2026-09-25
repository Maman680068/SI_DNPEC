import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ModeReservation, NotificationType, Prisma, StatutReservation as R, SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ROLE_LIBELLE } from '../role-change/roles';
import { GestionnairesLogistiqueService } from './gestionnaires.service';
import { CreneauDto, FiltresReservationsDto, ModifierRessourceDto, MotifDto, MotifObligatoireDto, RessourceDto, ReserverDto } from './dto/logistique.dto';

export const ACTIVES: R[] = [R.EN_ATTENTE, R.CONFIRMEE];
const DUREE_MAX_MS = 7 * 24 * 3600e3;
const TOLERANCE_PASSE_MS = 5 * 60e3;

const TITULAIRE = { select: { id: true, firstName: true, lastName: true, role: true, divisionId: true, sectionId: true, celluleId: true } } as const;
const NOM = { select: { id: true, firstName: true, lastName: true } } as const;

const RESERVATION_SELECT = {
  id: true,
  ressource: { select: { id: true, nom: true, type: true, mode: true } },
  titulaireId: true,
  titulaire: TITULAIRE,
  creeePar: NOM,
  debut: true,
  fin: true,
  objet: true,
  meetingId: true,
  meeting: { select: { id: true, title: true } },
  statut: true,
  prioritaire: true,
  decideePar: NOM,
  decideeAt: true,
  motifRefus: true,
  annuleePar: NOM,
  annuleeAt: true,
  motifAnnulation: true,
  evinceePar: NOM,
  createdAt: true,
} satisfies Prisma.ReservationSelect;

type ReservationBrute = Prisma.ReservationGetPayload<{ select: typeof RESERVATION_SELECT }>;
type Titulaire = ReservationBrute['titulaire'];

export interface ReservationCreee {
  id: string;
  statut: R;
  ressource: { id: string; nom: string; mode: ModeReservation };
  evincees: ReservationBrute[];
}

const fmt = (d: Date) =>
  d.toLocaleString('fr-FR', { timeZone: 'Africa/Conakry', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const nomDe = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

/**
 * Réservation des salles et du matériel de présentation (décision D9-3) :
 * - chaque ressource a son mode : confirmation immédiate si le créneau est
 *   libre, ou validation par un gestionnaire (le créneau est tenu en attendant) ;
 * - aucun chevauchement entre réservations actives (verrou de la ressource
 *   dans la transaction, trigger en base en filet de sécurité) ;
 * - PRIORITÉ HIÉRARCHIQUE : une personne ayant autorité hiérarchique sur le
 *   titulaire d'une réservation (cascade ; DN/DNA sur tous) peut prendre le
 *   créneau. La réservation évincée passe « annulée pour priorité », son
 *   titulaire est notifié avec le nom du prioritaire, tout est audité.
 *   Jamais entre pairs, jamais vers le haut (le DNA n'évince pas le DN), jamais
 *   sur soi-même ni sur le titulaire dont on assure l'intérim.
 */
@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cascade: CascadeService,
    private readonly notifications: NotificationsService,
    private readonly gestionnaires: GestionnairesLogistiqueService,
  ) {}

  // ------------------------------------------------------------ Règle de priorité

  /** `actor` peut-il évincer une réservation de `titulaire` ? */
  peutEvincer(actor: AuthenticatedUser, titulaire: Titulaire): boolean {
    if (this.cascade.isActingFor(actor, titulaire.id)) return false;
    // Jamais vers le haut : le DNA n'a pas autorité sur le DN.
    if (titulaire.role === SystemRole.DN && actor.role !== SystemRole.DN) return false;
    return this.cascade.hasDirectAuthorityOver(actor, titulaire);
  }

  // ------------------------------------------------------------ Ressources

  async ressources(actor: AuthenticatedUser) {
    const gestionnaire = await this.gestionnaires.estGestionnaire(actor);
    const liste = await this.prisma.ressourceReservable.findMany({
      where: gestionnaire ? {} : { actif: true },
      orderBy: [{ type: 'asc' }, { nom: 'asc' }],
    });
    return liste.map((r) => ({ ...r, droits: { modifier: gestionnaire } }));
  }

  async creerRessource(actor: AuthenticatedUser, dto: RessourceDto) {
    await this.gestionnaires.assertGestionnaire(actor);
    if (await this.prisma.ressourceReservable.findUnique({ where: { nom: dto.nom } })) throw new ConflictException(`Une ressource « ${dto.nom} » existe déjà.`);
    const r = await this.prisma.ressourceReservable.create({ data: dto });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'RessourceReservable', entityId: r.id, metadata: { ...dto } });
    return r;
  }

  async modifierRessource(actor: AuthenticatedUser, id: string, dto: ModifierRessourceDto) {
    await this.gestionnaires.assertGestionnaire(actor);
    const avant = await this.prisma.ressourceReservable.findUnique({ where: { id } });
    if (!avant) throw new NotFoundException('Ressource introuvable');
    if (dto.nom && dto.nom !== avant.nom && (await this.prisma.ressourceReservable.findUnique({ where: { nom: dto.nom } }))) {
      throw new ConflictException(`Une ressource « ${dto.nom} » existe déjà.`);
    }
    const r = await this.prisma.ressourceReservable.update({ where: { id }, data: dto });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'RessourceReservable', entityId: id, metadata: { ...dto } });
    return r;
  }

  /**
   * Disponibilité sur un créneau, par ressource active : libre, ou occupée
   * avec les réservations en conflit et, pour chacune, si l'appelant peut
   * faire valoir sa priorité. Liste de choix des écrans (réservation, salle
   * d'une réunion) : la création accepte exactement ce qui est annoncé ici.
   */
  async disponibilite(actor: AuthenticatedUser, dto: CreneauDto) {
    const { debut, fin } = this.creneau(dto.debut, dto.fin);
    const gestionnaire = await this.gestionnaires.estGestionnaire(actor);
    const ressources = await this.prisma.ressourceReservable.findMany({
      where: { actif: true, ...(dto.type ? { type: dto.type } : {}) },
      include: {
        reservations: { where: { statut: { in: ACTIVES }, debut: { lt: fin }, fin: { gt: debut } }, select: RESERVATION_SELECT, orderBy: { debut: 'asc' } },
      },
      orderBy: [{ type: 'asc' }, { nom: 'asc' }],
    });
    return ressources.map(({ reservations, ...r }) => {
      const conflits = reservations.map((c) => ({ ...this.vueCourte(actor, c, gestionnaire), evincable: this.peutEvincer(actor, c.titulaire) }));
      return { ...r, libre: conflits.length === 0, conflits, prioritePossible: conflits.length > 0 && conflits.every((c) => c.evincable) };
    });
  }

  // ------------------------------------------------------------ Lecture

  /** Objet visible du titulaire, des gestionnaires et de sa hiérarchie ; ailleurs, seulement « réservé par ». */
  private objetVisible(actor: AuthenticatedUser, r: ReservationBrute, gestionnaire: boolean): boolean {
    return gestionnaire || this.cascade.isActingFor(actor, r.titulaireId) || this.cascade.canSeeUserInLeadershipScope(actor, r.titulaire);
  }

  private vueCourte(actor: AuthenticatedUser, r: ReservationBrute, gestionnaire: boolean) {
    const visible = this.objetVisible(actor, r, gestionnaire);
    return {
      id: r.id,
      debut: r.debut,
      fin: r.fin,
      statut: r.statut,
      titulaire: { id: r.titulaire.id, firstName: r.titulaire.firstName, lastName: r.titulaire.lastName },
      objet: visible ? r.objet : null,
    };
  }

  private vue(actor: AuthenticatedUser, r: ReservationBrute, gestionnaire: boolean) {
    const visible = this.objetVisible(actor, r, gestionnaire);
    const soiMeme = this.cascade.isActingFor(actor, r.titulaireId);
    const active = ACTIVES.includes(r.statut);
    const aVenir = r.debut.getTime() > Date.now();
    const { titulaire, meeting, ...reste } = r;
    return {
      ...reste,
      titulaire: { id: titulaire.id, firstName: titulaire.firstName, lastName: titulaire.lastName },
      objet: visible ? r.objet : null,
      meeting: visible ? meeting : null,
      droits: {
        // Une réservation de réunion se libère en annulant la réunion.
        annuler: active && aVenir && ((soiMeme && !r.meetingId) || (gestionnaire && !soiMeme)),
        valider: gestionnaire && !soiMeme && r.statut === R.EN_ATTENTE,
        refuser: gestionnaire && !soiMeme && r.statut === R.EN_ATTENTE,
      },
    };
  }

  async lister(actor: AuthenticatedUser, f: FiltresReservationsDto) {
    const gestionnaire = await this.gestionnaires.estGestionnaire(actor);
    const where: Prisma.ReservationWhereInput =
      f.vue === 'miennes'
        ? { OR: [{ titulaireId: actor.id }, { creeeParId: actor.id }] }
        : f.vue === 'a_valider'
          ? gestionnaire
            ? { statut: R.EN_ATTENTE, titulaireId: { not: actor.id } }
            : { id: '__aucune__' }
          : { statut: { in: ACTIVES } };
    const du = f.du ? new Date(f.du) : undefined;
    const au = f.au ? new Date(f.au) : undefined;
    const liste = await this.prisma.reservation.findMany({
      where: { AND: [where, f.ressourceId ? { ressourceId: f.ressourceId } : {}, au ? { debut: { lt: au } } : {}, du ? { fin: { gt: du } } : {}] },
      select: RESERVATION_SELECT,
      orderBy: { debut: f.vue === 'miennes' ? 'desc' : 'asc' },
      take: 500,
    });
    return liste.map((r) => this.vue(actor, r, gestionnaire));
  }

  async fiche(actor: AuthenticatedUser, id: string) {
    const r = await this.prisma.reservation.findUnique({ where: { id }, select: RESERVATION_SELECT });
    if (!r) throw new NotFoundException('Réservation introuvable');
    return this.vue(actor, r, await this.gestionnaires.estGestionnaire(actor));
  }

  // ------------------------------------------------------------ Réserver

  private creneau(d: string, f: string) {
    const debut = new Date(d);
    const fin = new Date(f);
    if (!(fin > debut)) throw new BadRequestException('La fin du créneau doit être après son début.');
    if (fin.getTime() - debut.getTime() > DUREE_MAX_MS) throw new BadRequestException('Un créneau ne peut pas dépasser 7 jours.');
    return { debut, fin };
  }

  async reserver(actor: AuthenticatedUser, dto: ReserverDto) {
    const cree = await this.prisma.$transaction((tx) => this.creerDansTransaction(tx, actor, { ...dto, meetingId: null }), { maxWait: 10_000, timeout: 20_000 });
    await this.apresCreation(actor, cree, dto.objet);
    return this.fiche(actor, cree.id);
  }

  /**
   * Création DANS une transaction (réutilisée par la création d'une réunion) :
   * verrou de la ressource, conflits, éviction éventuelle, insertion.
   * Notifications et audit : `apresCreation`, après le commit.
   */
  async creerDansTransaction(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    dto: { ressourceId: string; debut: string; fin: string; objet: string; prioritaire?: boolean; meetingId: string | null },
  ): Promise<ReservationCreee> {
    const { debut, fin } = this.creneau(dto.debut, dto.fin);
    if (debut.getTime() < Date.now() - TOLERANCE_PASSE_MS) throw new BadRequestException('Le créneau est déjà commencé ou passé.');
    const verrou = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ressources_reservables" WHERE "id" = ${dto.ressourceId} FOR UPDATE`;
    if (verrou.length === 0) throw new NotFoundException('Ressource introuvable');
    const ressource = await tx.ressourceReservable.findUniqueOrThrow({ where: { id: dto.ressourceId } });
    if (!ressource.actif) throw new ConflictException(`La ressource « ${ressource.nom} » n’est plus réservable.`);

    const conflits = await tx.reservation.findMany({
      where: { ressourceId: ressource.id, statut: { in: ACTIVES }, debut: { lt: fin }, fin: { gt: debut } },
      select: RESERVATION_SELECT,
      orderBy: { debut: 'asc' },
    });
    if (conflits.length > 0) {
      const liste = conflits.map((c) => `${nomDe(c.titulaire)} (${fmt(c.debut)} – ${fmt(c.fin)})`).join(', ');
      if (conflits.some((c) => this.cascade.isActingFor(actor, c.titulaireId))) {
        throw new ConflictException(`Vous avez déjà réservé « ${ressource.nom} » sur ce créneau.`);
      }
      const possible = conflits.every((c) => this.peutEvincer(actor, c.titulaire));
      if (!dto.prioritaire) {
        throw new ConflictException(
          `« ${ressource.nom} » est déjà réservée sur ce créneau : ${liste}.${possible ? ' Vous pouvez faire valoir la priorité hiérarchique.' : ''}`,
        );
      }
      const hors = conflits.filter((c) => !this.peutEvincer(actor, c.titulaire));
      if (hors.length > 0) {
        throw new ForbiddenException(
          `Priorité impossible : ${hors.map((c) => nomDe(c.titulaire)).join(', ')} n’est pas sous votre autorité hiérarchique.`,
        );
      }
    }

    // Une réservation prioritaire est une décision d'autorité : confirmée d'emblée.
    const statut = ressource.mode === ModeReservation.IMMEDIATE || conflits.length > 0 ? R.CONFIRMEE : R.EN_ATTENTE;
    const titulaireId = actor.id;
    const now = new Date();
    for (const c of conflits) {
      await tx.reservation.update({
        where: { id: c.id },
        data: { statut: R.ANNULEE_PRIORITE, annuleeParId: actor.id, annuleeAt: now, evinceeParId: actor.id, motifAnnulation: 'Priorité hiérarchique' },
      });
      if (c.meetingId) await tx.meeting.update({ where: { id: c.meetingId }, data: { location: null } });
    }
    const cree = await tx.reservation.create({
      data: {
        ressourceId: ressource.id,
        titulaireId,
        creeeParId: actor.id,
        debut,
        fin,
        objet: dto.objet,
        meetingId: dto.meetingId,
        statut,
        prioritaire: conflits.length > 0,
      },
      select: { id: true },
    });
    if (conflits.length > 0) {
      await tx.reservation.updateMany({ where: { id: { in: conflits.map((c) => c.id) } }, data: { remplaceeParId: cree.id } });
    }
    return { id: cree.id, statut, ressource: { id: ressource.id, nom: ressource.nom, mode: ressource.mode }, evincees: conflits };
  }

  async apresCreation(actor: AuthenticatedUser, cree: ReservationCreee, objet: string): Promise<void> {
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'Reservation',
      entityId: cree.id,
      metadata: { ressource: cree.ressource.nom, statut: cree.statut, priorite: cree.evincees.map((e) => e.id) },
    });
    const prioritaire = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { firstName: true, lastName: true, role: true } });
    const qualite = ROLE_LIBELLE[actor.role] ?? actor.role;
    for (const e of cree.evincees) {
      await this.audit.log({
        actorId: actor.id,
        action: AuditAction.MODIFICATION,
        entityType: 'Reservation',
        entityId: e.id,
        metadata: { event: 'annulee_priorite', titulaireId: e.titulaireId, prioritaireId: actor.id, nouvelleReservationId: cree.id },
      });
      await this.notifications.notify(
        e.titulaireId,
        NotificationType.RESERVATION_ANNULEE_PRIORITE,
        'Réservation annulée pour priorité',
        `Votre réservation de « ${cree.ressource.nom} » du ${fmt(e.debut)} au ${fmt(e.fin)} (${e.objet}) est annulée : ${nomDe(prioritaire)} (${qualite}) a fait valoir la priorité hiérarchique.${e.meetingId ? ' Votre réunion est conservée, sans salle : choisissez-en une autre.' : ''}`,
        `/logistique?onglet=reservations&reservation=${e.id}`,
        cree.ressource.nom,
      );
    }
    if (cree.statut === R.EN_ATTENTE) {
      for (const uid of await this.gestionnaires.idsGestionnaires()) {
        if (uid === actor.id) continue;
        await this.notifications.notify(
          uid,
          NotificationType.RESERVATION_A_VALIDER,
          'Réservation à valider',
          `${nomDe(prioritaire)} — ${cree.ressource.nom} : ${objet}`,
          `/logistique?onglet=reservations&reservation=${cree.id}`,
          cree.ressource.nom,
        );
      }
    }
  }

  // ------------------------------------------------------------ Décisions

  private async charger(id: string) {
    const r = await this.prisma.reservation.findUnique({ where: { id }, select: RESERVATION_SELECT });
    if (!r) throw new NotFoundException('Réservation introuvable');
    return r;
  }

  private async transition(id: string, de: R[], data: Prisma.ReservationUncheckedUpdateManyInput) {
    const n = await this.prisma.reservation.updateMany({ where: { id, statut: { in: de } }, data });
    if (n.count === 0) throw new ConflictException('Cette réservation a changé d’état : rechargez-la.');
  }

  private async assertGestionnaireNonTitulaire(actor: AuthenticatedUser, r: ReservationBrute) {
    await this.gestionnaires.assertGestionnaire(actor);
    if (this.cascade.isActingFor(actor, r.titulaireId)) throw new ForbiddenException('Vous ne pouvez pas statuer sur votre propre réservation.');
  }

  async valider(actor: AuthenticatedUser, id: string) {
    const r = await this.charger(id);
    await this.assertGestionnaireNonTitulaire(actor, r);
    if (r.statut !== R.EN_ATTENTE) throw new ConflictException('Seule une réservation en attente peut être validée.');
    await this.transition(id, [R.EN_ATTENTE], { statut: R.CONFIRMEE, decideeParId: actor.id, decideeAt: new Date() });
    await this.audit.log({ actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'Reservation', entityId: id, metadata: { event: 'validation' } });
    await this.notifications.notify(
      r.titulaireId,
      NotificationType.RESERVATION_CONFIRMEE,
      'Réservation confirmée',
      `${r.ressource.nom} — ${fmt(r.debut)} au ${fmt(r.fin)} : ${r.objet}`,
      `/logistique?onglet=reservations&reservation=${id}`,
      r.ressource.nom,
    );
    return this.fiche(actor, id);
  }

  async refuser(actor: AuthenticatedUser, id: string, dto: MotifObligatoireDto) {
    const r = await this.charger(id);
    await this.assertGestionnaireNonTitulaire(actor, r);
    if (r.statut !== R.EN_ATTENTE) throw new ConflictException('Seule une réservation en attente peut être refusée.');
    await this.transition(id, [R.EN_ATTENTE], { statut: R.REFUSEE, decideeParId: actor.id, decideeAt: new Date(), motifRefus: dto.motif });
    if (r.meetingId) await this.prisma.meeting.update({ where: { id: r.meetingId }, data: { location: null } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.REJET, entityType: 'Reservation', entityId: id, metadata: { motif: dto.motif } });
    await this.notifications.notify(
      r.titulaireId,
      NotificationType.RESERVATION_REFUSEE,
      'Réservation refusée',
      `${r.ressource.nom} — ${fmt(r.debut)} : ${dto.motif}`,
      `/logistique?onglet=reservations&reservation=${id}`,
      r.ressource.nom,
    );
    return this.fiche(actor, id);
  }

  /** Titulaire (sans motif, avant le début, hors réunion) ou gestionnaire (motif obligatoire). */
  async annuler(actor: AuthenticatedUser, id: string, dto: MotifDto) {
    const r = await this.charger(id);
    const soiMeme = this.cascade.isActingFor(actor, r.titulaireId);
    if (!soiMeme) {
      await this.gestionnaires.assertGestionnaire(actor);
      if (!dto.motif) throw new BadRequestException('L’annulation par un gestionnaire exige un motif.');
    }
    if (!ACTIVES.includes(r.statut)) throw new ConflictException('Cette réservation n’est plus active.');
    if (r.debut.getTime() <= Date.now()) throw new ConflictException('Le créneau a commencé : la réservation ne peut plus être annulée.');
    if (soiMeme && r.meetingId) throw new ConflictException('Cette salle est réservée pour une réunion : annulez la réunion pour la libérer.');
    await this.transition(id, ACTIVES, { statut: R.ANNULEE, annuleeParId: actor.id, annuleeAt: new Date(), motifAnnulation: dto.motif ?? null });
    if (r.meetingId) await this.prisma.meeting.update({ where: { id: r.meetingId }, data: { location: null } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Reservation', entityId: id, metadata: { event: 'annulation', motif: dto.motif ?? null } });
    if (!soiMeme) {
      await this.notifications.notify(
        r.titulaireId,
        NotificationType.RESERVATION_ANNULEE,
        'Réservation annulée',
        `${r.ressource.nom} — ${fmt(r.debut)} : ${dto.motif}`,
        `/logistique?onglet=reservations&reservation=${id}`,
        r.ressource.nom,
      );
    }
    return this.fiche(actor, id);
  }

  /** Annulation d'une réunion : sa salle est libérée (appelé par MeetingsService). */
  async libererPourReunion(actor: AuthenticatedUser, meetingId: string): Promise<void> {
    const r = await this.prisma.reservation.findFirst({ where: { meetingId, statut: { in: ACTIVES } }, select: { id: true } });
    if (!r) return;
    await this.transition(r.id, ACTIVES, { statut: R.ANNULEE, annuleeParId: actor.id, annuleeAt: new Date(), motifAnnulation: 'Réunion annulée' });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Reservation', entityId: r.id, metadata: { event: 'annulation', motif: 'Réunion annulée', meetingId } });
  }

  async aValiderCount(actor: AuthenticatedUser): Promise<number> {
    if (!(await this.gestionnaires.estGestionnaire(actor))) return 0;
    return this.prisma.reservation.count({ where: { statut: R.EN_ATTENTE, titulaireId: { not: actor.id } } });
  }
}
