import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, NotificationType, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { ObjetsPlateformeService } from './objets-plateforme.service';
import { MessageFilDto, NouveauFilDto } from './dto/fils.dto';

const nom = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;
const extrait = (s: string) => (s.length > 200 ? `${s.slice(0, 200)}…` : s);

/**
 * Fils de discussion (socle N5, SIG-RF-MSG) : objet, plusieurs destinataires, messages successifs,
 * accusé de lecture par destinataire, pièce jointe = renvoi vers un objet de la plateforme. Réservé
 * aux participants ; personnel (jugé sur `actor.id`, jamais emprunté en intérim). La messagerie
 * directe (un à un) reste inchangée.
 */
@Injectable()
export class FilsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly objets: ObjetsPlateformeService,
  ) {}

  async lister(actor: AuthenticatedUser) {
    const fils = await this.prisma.filMessages.findMany({
      where: { participants: { some: { userId: actor.id } } },
      orderBy: { dernierMessageLe: 'desc' },
      select: {
        id: true, objet: true, dernierMessageLe: true,
        participants: { select: { user: { select: { id: true, firstName: true, lastName: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { corps: true, auteur: { select: { firstName: true, lastName: true } } } },
        _count: { select: { messages: { where: { auteurId: { not: actor.id }, lectures: { none: { userId: actor.id } } } } } },
      },
    });
    return fils.map((f) => ({
      id: f.id,
      objet: f.objet,
      dernierMessageLe: f.dernierMessageLe,
      participants: f.participants.map((p) => ({ id: p.user.id, nom: nom(p.user) })),
      dernier: f.messages[0] ? { auteur: nom(f.messages[0].auteur), extrait: extrait(f.messages[0].corps) } : null,
      nonLus: f._count.messages,
    }));
  }

  /** Destinataires possibles : tout compte actif, sauf soi-même. */
  destinatairesPossibles(actor: AuthenticatedUser) {
    return this.prisma.user.findMany({
      where: { status: UserStatus.ACTIF, id: { not: actor.id } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async creer(actor: AuthenticatedUser, dto: NouveauFilDto) {
    const ids = [...new Set(dto.destinataires)].filter((id) => id !== actor.id);
    if (!ids.length) throw new BadRequestException('Au moins un destinataire autre que vous.');
    const actifs = await this.prisma.user.count({ where: { id: { in: ids }, status: UserStatus.ACTIF } });
    if (actifs !== ids.length) throw new BadRequestException('Un destinataire est introuvable ou inactif.');
    const lien = dto.lien ? await this.objets.exigerJoignable(actor, dto.lien.type, dto.lien.id) : null;
    const fil = await this.prisma.$transaction(async (tx) => {
      const f = await tx.filMessages.create({
        data: { objet: dto.objet.trim(), creeParId: actor.id, participants: { create: [actor.id, ...ids].map((userId) => ({ userId })) } },
        select: { id: true },
      });
      await tx.messageFil.create({ data: { filId: f.id, auteurId: actor.id, corps: dto.corps, lienType: lien?.type ?? null, lienId: lien?.id ?? null } });
      await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'FilMessages', entityId: f.id, metadata: { event: 'fil_cree', participants: ids.length + 1 } }, tx);
      return f;
    });
    await this.prevenir(actor, fil.id, ids, dto.objet, dto.corps);
    return this.detail(actor, fil.id);
  }

  async repondre(actor: AuthenticatedUser, filId: string, dto: MessageFilDto) {
    const fil = await this.chargerParticipant(actor, filId);
    const lien = dto.lien ? await this.objets.exigerJoignable(actor, dto.lien.type, dto.lien.id) : null;
    const maintenant = new Date();
    await this.prisma.$transaction([
      this.prisma.messageFil.create({ data: { filId, auteurId: actor.id, corps: dto.corps, lienType: lien?.type ?? null, lienId: lien?.id ?? null, createdAt: maintenant } }),
      this.prisma.filMessages.update({ where: { id: filId }, data: { dernierMessageLe: maintenant } }),
    ]);
    await this.prevenir(actor, filId, fil.participants.map((p) => p.userId).filter((id) => id !== actor.id), fil.objet, dto.corps);
    return this.detail(actor, filId);
  }

  /** Ouvrir un fil vaut lecture de ses messages (accusé de lecture horodaté, par destinataire). */
  async detail(actor: AuthenticatedUser, filId: string) {
    await this.chargerParticipant(actor, filId);
    const nonLus = await this.prisma.messageFil.findMany({ where: { filId, auteurId: { not: actor.id }, lectures: { none: { userId: actor.id } } }, select: { id: true } });
    if (nonLus.length) {
      await this.prisma.lectureMessage.createMany({ data: nonLus.map((m) => ({ messageId: m.id, userId: actor.id })), skipDuplicates: true });
    }
    const f = await this.prisma.filMessages.findUniqueOrThrow({
      where: { id: filId },
      select: {
        id: true, objet: true, createdAt: true,
        participants: { select: { user: { select: { id: true, firstName: true, lastName: true } } } },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, corps: true, lienType: true, lienId: true, createdAt: true,
            auteur: { select: { id: true, firstName: true, lastName: true } },
            lectures: { select: { userId: true, luLe: true } },
          },
        },
      },
    });
    const participants = f.participants.map((p) => ({ id: p.user.id, nom: nom(p.user) }));
    const messages = [];
    for (const m of f.messages) {
      // Le lien n'est résolu que pour qui voit l'objet ; sinon ni titre ni adresse.
      const objet = m.lienType && m.lienId ? await this.objets.voir(actor, m.lienType, m.lienId) : null;
      const lus = new Map(m.lectures.map((l) => [l.userId, l.luLe]));
      messages.push({
        id: m.id,
        corps: m.corps,
        createdAt: m.createdAt,
        auteur: { id: m.auteur.id, nom: nom(m.auteur) },
        lien: m.lienType ? (objet ? { ...objet, accessible: true } : { type: m.lienType, accessible: false }) : null,
        // Accusés de lecture : visibles de tous les participants.
        lectures: participants.filter((p) => p.id !== m.auteur.id).map((p) => ({ ...p, luLe: lus.get(p.id) ?? null })),
      });
    }
    return { id: f.id, objet: f.objet, createdAt: f.createdAt, participants, messages };
  }

  private async chargerParticipant(actor: AuthenticatedUser, filId: string) {
    const fil = await this.prisma.filMessages.findUnique({ where: { id: filId }, select: { objet: true, participants: { select: { userId: true } } } });
    // Non-participant : 404, l'existence du fil n'est pas divulguée.
    if (!fil || !fil.participants.some((p) => p.userId === actor.id)) throw new NotFoundException('Fil de discussion introuvable');
    return fil;
  }

  private async prevenir(actor: AuthenticatedUser, filId: string, destinataires: string[], objet: string, corps: string) {
    const auteur = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { firstName: true, lastName: true } });
    await this.notifications.notifyMany(destinataires, NotificationType.MESSAGE_DIRECT, `Message de ${nom(auteur)} : ${objet}`, extrait(corps), `/communication?fil=${filId}`, undefined, { libelleBouton: 'Lire le fil' });
  }
}
