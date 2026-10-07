import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, NotificationType, Prisma, RoleModelisation, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { peutDesigner } from './acces';
import { AffectationDto } from './dto/modelisation.dto';
import { LIEN_MODELE, ModelesService } from './modeles.service';

const LIBELLE_ROLE: Record<RoleModelisation, string> = { ANALYSTE: 'Analyste', RESPONSABLE: 'Responsable du modèle', SUPPLEANT: 'Suppléant du responsable' };

/**
 * Rôles de modélisation (domaine B, décision n° 1) : analyste attribué par l'administrateur ;
 * responsable et suppléant d'un modèle désignés par l'administrateur, le DN ou la DNA. Motif
 * obligatoire, historique conservé (une affectation se clôt, jamais ne s'efface : déclencheur),
 * personne prévenue, audit. Un stagiaire ne reçoit jamais de rôle de modélisation ; l'administrateur
 * n'est jamais analyste (il ne voit jamais les chiffres d'une simulation).
 */
@Injectable()
export class AffectationsModelisationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly modeles: ModelesService,
  ) {}

  private exigerLecture(actor: AuthenticatedUser): void {
    if (!peutDesigner(actor)) throw new ForbiddenException({ message: 'Les rôles de modélisation se gèrent par l’administrateur, le DN ou la DNA.', etape: 'ROLE', objetType: 'AffectationModelisation' });
  }

  private exigerDroit(actor: AuthenticatedUser, role: RoleModelisation): void {
    this.exigerLecture(actor);
    if (role === RoleModelisation.ANALYSTE && actor.role !== SystemRole.ADMIN_SYSTEME) {
      throw new ForbiddenException({ message: 'Le rôle d’analyste est attribué par l’administrateur.', etape: 'ROLE', objetType: 'AffectationModelisation' });
    }
  }

  /** Rôles d'une personne (ouverts et terminés) et listes de choix de l'écran. */
  async pourPersonne(actor: AuthenticatedUser, userId: string) {
    this.exigerLecture(actor);
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, firstName: true, lastName: true, role: true, status: true } });
    if (!u) throw new NotFoundException('Compte introuvable.');
    const affectations = await this.prisma.affectationModelisation.findMany({
      where: { userId },
      orderBy: [{ fin: { sort: 'desc', nulls: 'first' } }, { debut: 'desc' }],
      select: { id: true, role: true, motif: true, debut: true, fin: true, motifFin: true, attribueParId: true, finParId: true, modele: { select: { id: true, nom: true } } },
    });
    const ids = affectations.flatMap((a) => [a.attribueParId, a.finParId]).filter((x): x is string => !!x);
    const noms = new Map((await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } })).map((x) => [x.id, `${x.firstName} ${x.lastName}`]));
    const modeles = await this.prisma.modele.findMany({
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true, affectations: { where: { fin: null, role: { not: RoleModelisation.ANALYSTE } }, select: { role: true, userId: true } } },
    });
    const nomsModeles = new Map((await this.prisma.user.findMany({ where: { id: { in: modeles.flatMap((m) => m.affectations.map((a) => a.userId)) } }, select: { id: true, firstName: true, lastName: true } })).map((x) => [x.id, `${x.firstName} ${x.lastName}`]));
    const ineligible = u.role === SystemRole.STAGIAIRE ? 'Un stagiaire ne reçoit jamais de rôle de modélisation.' : u.status !== UserStatus.ACTIF ? 'Le compte n’est pas actif.' : null;
    return {
      compte: { id: u.id, nom: `${u.firstName} ${u.lastName}`, role: u.role, ineligible },
      affectations: affectations.map((a) => ({
        id: a.id,
        role: a.role,
        libelle: LIBELLE_ROLE[a.role],
        modele: a.modele,
        motif: a.motif,
        debut: a.debut,
        attribuePar: noms.get(a.attribueParId) ?? null,
        fin: a.fin,
        finPar: a.finParId ? noms.get(a.finParId) ?? null : null,
        motifFin: a.motifFin,
        peutClore: !a.fin && (a.role !== RoleModelisation.ANALYSTE || actor.role === SystemRole.ADMIN_SYSTEME),
      })),
      droits: {
        peutAttribuerAnalyste: actor.role === SystemRole.ADMIN_SYSTEME && !ineligible && u.role !== SystemRole.ADMIN_SYSTEME,
        peutDesigner: !ineligible,
      },
      modeles: modeles.map((m) => ({
        id: m.id,
        nom: m.nom,
        responsable: nomsModeles.get(m.affectations.find((a) => a.role === RoleModelisation.RESPONSABLE)?.userId ?? '') ?? null,
        suppleant: nomsModeles.get(m.affectations.find((a) => a.role === RoleModelisation.SUPPLEANT)?.userId ?? '') ?? null,
      })),
    };
  }

  /** Personnes qu'on peut désigner responsable ou suppléant (fiche du modèle) : comptes actifs, hors stagiaires. */
  async designables(actor: AuthenticatedUser) {
    this.exigerLecture(actor);
    const u = await this.prisma.user.findMany({
      where: { status: UserStatus.ACTIF, role: { not: SystemRole.STAGIAIRE } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, jobTitle: true },
    });
    return u.map((x) => ({ id: x.id, nom: `${x.firstName} ${x.lastName}`, fonction: x.jobTitle ?? null }));
  }

  async attribuer(actor: AuthenticatedUser, dto: AffectationDto) {
    const role = dto.role as RoleModelisation;
    this.exigerDroit(actor, role);
    const u = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true, firstName: true, lastName: true, role: true, status: true } });
    if (!u) throw new NotFoundException('Compte introuvable.');
    if (u.role === SystemRole.STAGIAIRE) throw new ConflictException('Un stagiaire ne reçoit jamais de rôle de modélisation.');
    if (u.status !== UserStatus.ACTIF) throw new ConflictException('Le compte n’est pas actif.');
    if (role === RoleModelisation.ANALYSTE && u.role === SystemRole.ADMIN_SYSTEME) throw new ConflictException('L’administrateur n’est jamais analyste : il ne voit jamais les chiffres d’une simulation.');
    let modele: { id: string; nom: string } | null = null;
    if (role !== RoleModelisation.ANALYSTE) {
      if (!dto.modeleId) throw new ConflictException('Choisissez le modèle.');
      modele = await this.prisma.modele.findUnique({ where: { id: dto.modeleId }, select: { id: true, nom: true } });
      if (!modele) throw new NotFoundException('Modèle introuvable.');
    } else if (dto.modeleId) throw new ConflictException('Le rôle d’analyste ne porte sur aucun modèle en particulier.');
    const motif = dto.motif.trim();
    const cree = await this.prisma
      .$transaction(async (tx) => {
        if (role === RoleModelisation.ANALYSTE) {
          if (await tx.affectationModelisation.count({ where: { userId: u.id, role, fin: null } })) throw new ConflictException(`${u.firstName} ${u.lastName} est déjà analyste.`);
        } else {
          const autre = role === RoleModelisation.RESPONSABLE ? RoleModelisation.SUPPLEANT : RoleModelisation.RESPONSABLE;
          if (await tx.affectationModelisation.count({ where: { userId: u.id, modeleId: modele!.id, role: autre, fin: null } })) {
            throw new ConflictException(`${u.firstName} ${u.lastName} est déjà ${LIBELLE_ROLE[autre].toLowerCase()} de ce modèle : une même personne ne peut pas être les deux.`);
          }
          // Remplacement : la désignation en place se clôt (historique conservé).
          const enPlace = await tx.affectationModelisation.findFirst({ where: { modeleId: modele!.id, role, fin: null }, select: { id: true, userId: true } });
          if (enPlace?.userId === u.id) throw new ConflictException(`${u.firstName} ${u.lastName} est déjà ${LIBELLE_ROLE[role].toLowerCase()} de ce modèle.`);
          if (enPlace) {
            await tx.affectationModelisation.update({ where: { id: enPlace.id }, data: { fin: new Date(), finParId: actor.id, motifFin: `Remplacé(e) : ${motif}` } });
            await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'AffectationModelisation', entityId: enPlace.id, metadata: { event: 'fin_role_modelisation', role, modeleId: modele!.id, userId: enPlace.userId, motif: `Remplacé(e) : ${motif}` } }, tx);
          }
        }
        const a = await tx.affectationModelisation.create({ data: { userId: u.id, role, modeleId: modele?.id ?? null, attribueParId: actor.id, motif }, select: { id: true } });
        await this.audit.log(
          { actorId: actor.id, action: AuditAction.CREATION, entityType: 'AffectationModelisation', entityId: a.id, metadata: { event: 'attribution_role_modelisation', role, modeleId: modele?.id ?? null, userId: u.id, motif } },
          tx,
        );
        return a;
      })
      .catch((e) => {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Cette désignation vient d’être faite par quelqu’un d’autre : rechargez.');
        throw e;
      });
    await this.notifications.notify(
      u.id,
      NotificationType.ROLE_MODIFIE,
      `Rôle de modélisation : ${LIBELLE_ROLE[role]}${modele ? ` — ${modele.nom}` : ''}`,
      `Vous êtes désormais ${LIBELLE_ROLE[role].toLowerCase()}${modele ? ` du modèle « ${modele.nom} »` : ' des modèles'}. Motif : ${motif}`,
      modele ? LIEN_MODELE(modele.id) : '/modelisation',
      undefined,
      { libelleBouton: 'Ouvrir la modélisation' },
    );
    // Une version attend peut-être déjà l'approbation du nouveau responsable ou suppléant.
    if (modele) {
      const attente = await this.prisma.versionModele.findFirst({ where: { modeleId: modele.id, statut: 'EN_ATTENTE' }, select: { id: true } });
      if (attente) await this.modeles.prevenirAApprouver(modele.id, attente.id, actor.id);
    }
    return { id: cree.id };
  }

  async clore(actor: AuthenticatedUser, id: string, motif: string) {
    const a = await this.prisma.affectationModelisation.findUnique({ where: { id }, select: { id: true, role: true, userId: true, fin: true, modele: { select: { id: true, nom: true } } } });
    if (!a) throw new NotFoundException('Rôle de modélisation introuvable.');
    this.exigerDroit(actor, a.role);
    if (a.fin) throw new ConflictException('Ce rôle a déjà pris fin.');
    await this.prisma.$transaction(async (tx) => {
      await tx.affectationModelisation.update({ where: { id }, data: { fin: new Date(), finParId: actor.id, motifFin: motif.trim() } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'AffectationModelisation', entityId: id, metadata: { event: 'fin_role_modelisation', role: a.role, modeleId: a.modele?.id ?? null, userId: a.userId, motif: motif.trim() } }, tx);
    });
    await this.notifications.notify(
      a.userId,
      NotificationType.ROLE_MODIFIE,
      `Fin du rôle de modélisation : ${LIBELLE_ROLE[a.role]}${a.modele ? ` — ${a.modele.nom}` : ''}`,
      `Motif : ${motif.trim()}`,
      '/modelisation',
      undefined,
      { libelleBouton: 'Ouvrir la modélisation' },
    );
    return { id };
  }
}
