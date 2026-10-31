import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EtatDemandeReunion, NotificationType, Prisma, SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { chefsLesPlusProches } from '../socle/chefs-proches';
import { creeReunionDirectement, demandeReunion } from './createurs';
import { ParticipantsReunionService } from './participants-reunion.service';
import { AccepterDemandeDto, DemandeReunionDto } from './dto/demande-reunion.dto';

const DEMANDE_SELECT = {
  id: true,
  demandeurId: true,
  demandeur: { select: { id: true, firstName: true, lastName: true } },
  objet: true,
  explication: true,
  debut: true,
  fin: true,
  participantIds: true,
  uniteIds: true,
  etat: true,
  decideurIds: true,
  decideParId: true,
  decidePar: { select: { firstName: true, lastName: true } },
  decideeLe: true,
  motifRefus: true,
  reunionId: true,
  createdAt: true,
  etapes: { select: { action: true, parId: true, versIds: true, motif: true, le: true }, orderBy: { le: 'asc' } },
} satisfies Prisma.DemandeReunionSelect;
type DemandeLue = Prisma.DemandeReunionGetPayload<{ select: typeof DEMANDE_SELECT }>;

const RATTACHEMENT = { id: true, role: true, supervisorId: true, divisionId: true, sectionId: true, celluleId: true } as const;
const nomDe = (u: { firstName: string; lastName: string } | null | undefined) => (u ? `${u.firstName} ${u.lastName}` : null);
const dateFr = (d: Date) => d.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Conakry' });

/**
 * Demandes de réunion (S1, docs/conception_S1_demandes_reunion.md). Le chargé d'études demande ; son chef
 * le plus proche (ou son suppléant en intérim) accepte — en modifiant au besoin date et participants —,
 * refuse avec un motif, ou transmet à son propre chef, jusqu'au DN ou à la DNA. Une demande acceptée vaut
 * autorisation à usage unique de créer la réunion (consommée par `MeetingsService.create`), expirée si la
 * date passe.
 */
@Injectable()
export class DemandesReunionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly participants: ParticipantsReunionService,
  ) {}

  /** Le décideur que l'acteur incarne (lui-même, ou le titulaire dont il assure l'intérim). */
  private estDecideur(actor: AuthenticatedUser, d: { decideurIds: string[] }): boolean {
    return d.decideurIds.includes(actor.id) || (!!actor.interimForId && d.decideurIds.includes(actor.interimForId));
  }

  static expiree(d: { etat: EtatDemandeReunion; debut: Date; reunionId: string | null }, maintenant = new Date()): boolean {
    return d.etat === EtatDemandeReunion.ACCEPTEE && !d.reunionId && d.debut.getTime() <= maintenant.getTime();
  }

  private async noms(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    return new Map((await this.prisma.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  private async vues(actor: AuthenticatedUser, ds: DemandeLue[]) {
    const ids = ds.flatMap((d) => [...d.participantIds, ...d.decideurIds, ...d.etapes.flatMap((e) => [e.parId ?? '', ...e.versIds])]).filter(Boolean);
    const noms = await this.noms(ids);
    const unites = new Map((await this.prisma.uniteOrganisationnelle.findMany({ where: { id: { in: [...new Set(ds.flatMap((d) => d.uniteIds))] } }, select: { id: true, code: true, libelle: true } })).map((u) => [u.id, u]));
    const maintenant = new Date();
    return ds.map((d) => {
      const decideur = d.etat === EtatDemandeReunion.EN_ATTENTE && this.estDecideur(actor, d);
      const expiree = DemandesReunionService.expiree(d, maintenant);
      return {
        id: d.id,
        objet: d.objet,
        explication: d.explication,
        debut: d.debut,
        fin: d.fin,
        demandeur: { id: d.demandeur.id, nom: nomDe(d.demandeur)! },
        participants: d.participantIds.map((id) => ({ id, nom: noms.get(id) ?? '—' })),
        unites: d.uniteIds.map((id) => unites.get(id)).filter(Boolean).map((u) => ({ id: u!.id, code: u!.code, libelle: u!.libelle })),
        etat: expiree ? 'EXPIREE' : d.etat,
        decideurs: d.decideurIds.map((id) => noms.get(id) ?? '—'),
        decidePar: nomDe(d.decidePar),
        decideeLe: d.decideeLe,
        motifRefus: d.motifRefus,
        reunionId: d.reunionId,
        etapes: d.etapes.map((e) => ({ action: e.action, par: e.parId ? noms.get(e.parId) ?? null : null, vers: e.versIds.map((v) => noms.get(v) ?? '—'), motif: e.motif, le: e.le })),
        droits: {
          accepter: decideur,
          refuser: decideur,
          // Le DN et la DNA décident en dernier : ils ne transmettent pas.
          transmettre: decideur && actor.role !== SystemRole.DN && actor.role !== SystemRole.DNA,
          creerReunion: d.demandeurId === actor.id && !actor.interimForId && d.etat === EtatDemandeReunion.ACCEPTEE && !d.reunionId && !expiree,
        },
      };
    });
  }

  droits(actor: AuthenticatedUser) {
    return { creerReunion: creeReunionDirectement(actor), demanderReunion: demandeReunion(actor) };
  }

  async liste(actor: AuthenticatedUser) {
    if (actor.role === SystemRole.STAGIAIRE) throw new ForbiddenException('Les réunions ne sont pas ouvertes aux stagiaires.');
    const qui = [actor.id, ...(actor.interimForId ? [actor.interimForId] : [])];
    const [miennes, aDecider] = await Promise.all([
      this.prisma.demandeReunion.findMany({ where: { demandeurId: actor.id }, select: DEMANDE_SELECT, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.demandeReunion.findMany({ where: { etat: EtatDemandeReunion.EN_ATTENTE, decideurIds: { hasSome: qui } }, select: DEMANDE_SELECT, orderBy: { createdAt: 'asc' } }),
    ]);
    return { miennes: await this.vues(actor, miennes), aDecider: await this.vues(actor, aDecider), droits: this.droits(actor) };
  }

  /** Demandes à décider (« À traiter » du tableau de bord). */
  aDeciderCount(actor: AuthenticatedUser): Promise<number> {
    if (actor.role === SystemRole.STAGIAIRE) return Promise.resolve(0);
    const qui = [actor.id, ...(actor.interimForId ? [actor.interimForId] : [])];
    return this.prisma.demandeReunion.count({ where: { etat: EtatDemandeReunion.EN_ATTENTE, decideurIds: { hasSome: qui } } });
  }

  async lire(actor: AuthenticatedUser, id: string) {
    const d = await this.prisma.demandeReunion.findUnique({ where: { id }, select: DEMANDE_SELECT });
    // Visible du demandeur et des décideurs (actuels ou passés), jamais de personne d'autre.
    const vu = d && (d.demandeurId === actor.id || this.estDecideur(actor, d) || d.etapes.some((e) => e.parId === actor.id || e.versIds.includes(actor.id)));
    if (!d || !vu) throw new NotFoundException('Demande de réunion introuvable');
    return (await this.vues(actor, [d]))[0]!;
  }

  private periode(debut: string, fin: string) {
    const a = new Date(debut);
    const b = new Date(fin);
    if (!(b > a)) throw new BadRequestException('L’heure de fin doit suivre l’heure de début.');
    if (a.getTime() <= Date.now()) throw new BadRequestException('La réunion proposée doit être à venir.');
    return { debut: a, fin: b };
  }

  async demander(actor: AuthenticatedUser, dto: DemandeReunionDto) {
    if (!demandeReunion(actor)) {
      throw new ForbiddenException(actor.role === SystemRole.STAGIAIRE ? 'Les réunions ne sont pas ouvertes aux stagiaires.' : 'Vous créez vos réunions directement : « Nouvelle réunion ».');
    }
    const { debut, fin } = this.periode(dto.debut, dto.fin);
    const participantIds = dto.participantIds.filter((id) => id !== actor.id);
    const refus = await this.participants.verifier(participantIds);
    if (refus) throw new BadRequestException(refus);
    const moi = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: RATTACHEMENT });
    const decideurs = await chefsLesPlusProches(this.prisma, moi);
    if (!decideurs.length) throw new ConflictException('Aucun responsable actif ne peut décider de votre demande : prévenez l’administrateur.');
    const d = await this.prisma.demandeReunion.create({
      data: {
        demandeurId: actor.id,
        objet: dto.objet.trim(),
        explication: dto.explication.trim(),
        debut,
        fin,
        participantIds,
        uniteIds: dto.uniteIds ?? [],
        decideurIds: decideurs,
        etapes: { create: { action: 'DEMANDEE', parId: actor.id, versIds: decideurs } },
      },
      select: DEMANDE_SELECT,
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'DemandeReunion', entityId: d.id, metadata: { event: 'demandee', decideurs, participants: participantIds.length } });
    await this.prevenirDecideurs(d.id, decideurs, nomDe(d.demandeur)!, debut);
    return (await this.vues(actor, [d]))[0]!;
  }

  private async prevenirDecideurs(id: string, decideurs: string[], demandeur: string, debut: Date) {
    for (const u of decideurs) {
      await this.notifications.notify(u, NotificationType.REUNION_PLANIFIEE, 'Demande de réunion à examiner', `${demandeur} demande une réunion le ${dateFr(debut)}.`, `/reunions?demande=${id}`, demandeur, { libelleBouton: 'Examiner la demande' });
    }
  }

  private async aDecider(actor: AuthenticatedUser, id: string) {
    const d = await this.prisma.demandeReunion.findUnique({ where: { id }, select: DEMANDE_SELECT });
    if (!d) throw new NotFoundException('Demande de réunion introuvable');
    if (!this.estDecideur(actor, d)) throw new ForbiddenException('Cette demande de réunion ne vous est pas adressée.');
    if (d.etat !== EtatDemandeReunion.EN_ATTENTE) throw new ConflictException('Cette demande a déjà été décidée.');
    return d;
  }

  /** Changement d'état conditionnel : une seule décision, même si deux décideurs agissent ensemble. */
  private async decider(id: string, data: Prisma.DemandeReunionUncheckedUpdateManyInput) {
    const r = await this.prisma.demandeReunion.updateMany({ where: { id, etat: EtatDemandeReunion.EN_ATTENTE }, data });
    if (!r.count) throw new ConflictException('Cette demande a déjà été décidée.');
  }

  async accepter(actor: AuthenticatedUser, id: string, dto: AccepterDemandeDto) {
    const d = await this.aDecider(actor, id);
    const { debut, fin } = this.periode(dto.debut ?? d.debut.toISOString(), dto.fin ?? d.fin.toISOString());
    const participantIds = (dto.participantIds ?? d.participantIds).filter((p) => p !== d.demandeurId);
    const refus = await this.participants.verifier(participantIds);
    if (refus) throw new BadRequestException(refus);
    const modifiee = debut.getTime() !== d.debut.getTime() || fin.getTime() !== d.fin.getTime() || participantIds.join() !== d.participantIds.join();
    await this.decider(id, { etat: EtatDemandeReunion.ACCEPTEE, debut, fin, participantIds, uniteIds: dto.uniteIds ?? d.uniteIds, decideParId: actor.id, decideeLe: new Date() });
    await this.prisma.etapeDemandeReunion.create({ data: { demandeId: id, action: 'ACCEPTEE', parId: actor.id, versIds: [d.demandeurId], motif: modifiee ? 'Date ou participants modifiés' : null } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'DemandeReunion', entityId: id, metadata: { event: 'acceptee', modifiee } });
    await this.notifications.notify(d.demandeurId, NotificationType.REUNION_PLANIFIEE, 'Demande de réunion acceptée', `Votre réunion du ${dateFr(debut)} est validée : créez-la.`, `/reunions?demande=${id}&creer=1`, undefined, { libelleBouton: 'Créer la réunion' });
    return this.lire(actor, id);
  }

  async refuser(actor: AuthenticatedUser, id: string, motif: string) {
    const d = await this.aDecider(actor, id);
    const m = motif.trim();
    if (m.length < 3) throw new BadRequestException('Indiquez le motif du refus (3 caractères au moins).');
    await this.decider(id, { etat: EtatDemandeReunion.REFUSEE, motifRefus: m, decideParId: actor.id, decideeLe: new Date() });
    await this.prisma.etapeDemandeReunion.create({ data: { demandeId: id, action: 'REFUSEE', parId: actor.id, versIds: [d.demandeurId], motif: m } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.REJET, entityType: 'DemandeReunion', entityId: id, metadata: { event: 'refusee' } });
    // Le motif se lit dans l'application (aucun texte libre dans une notification).
    await this.notifications.notify(d.demandeurId, NotificationType.REUNION_ANNULEE, 'Demande de réunion refusée', 'Votre demande de réunion a été refusée : le motif est indiqué dans la demande.', `/reunions?demande=${id}`, undefined, { libelleBouton: 'Voir le motif' });
    return this.lire(actor, id);
  }

  async transmettre(actor: AuthenticatedUser, id: string) {
    const d = await this.aDecider(actor, id);
    // Le décideur incarné : soi, ou le titulaire dont on assure l'intérim.
    const decideurId = actor.interimForId && d.decideurIds.includes(actor.interimForId) ? actor.interimForId : actor.id;
    const decideur = await this.prisma.user.findUniqueOrThrow({ where: { id: decideurId }, select: RATTACHEMENT });
    if (decideur.role === SystemRole.DN || decideur.role === SystemRole.DNA) throw new ConflictException('La Direction décide en dernier : acceptez ou refusez la demande.');
    const suivants = (await chefsLesPlusProches(this.prisma, decideur)).filter((u) => u !== d.demandeurId);
    if (!suivants.length) throw new ConflictException('Aucun responsable au-dessus de vous ne peut recevoir cette demande.');
    const r = await this.prisma.demandeReunion.updateMany({ where: { id, etat: EtatDemandeReunion.EN_ATTENTE, decideurIds: { equals: d.decideurIds } }, data: { decideurIds: suivants } });
    if (!r.count) throw new ConflictException('Cette demande a déjà été décidée ou transmise.');
    await this.prisma.etapeDemandeReunion.create({ data: { demandeId: id, action: 'TRANSMISE', parId: actor.id, versIds: suivants } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'DemandeReunion', entityId: id, metadata: { event: 'transmise', vers: suivants } });
    await this.prevenirDecideurs(id, suivants, nomDe(d.demandeur)!, d.debut);
    return this.lire(actor, id);
  }
}
