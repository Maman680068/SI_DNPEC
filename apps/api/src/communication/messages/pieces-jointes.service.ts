import { BadRequestException, ForbiddenException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { AuditAction, SystemRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StorageService } from '../../common/storage/storage.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { DocumentsService } from '../../documents/documents.service';
import { motsRecherche, scoreRecherche } from '../../common/recherche/texte';
import { MessagesService } from './messages.service';
import { documentsCites } from './contexte-conversation.service';

/** Taille maximale d'un fichier envoyé par message. */
export const TAILLE_MAX_PIECE = 10 * 1024 * 1024;

type Nature = 'pdf' | 'png' | 'jpeg' | 'gif' | 'webp' | 'ole' | 'docx' | 'xlsx';
/** Extensions permises et la nature que le CONTENU du fichier doit avoir. */
const EXTENSIONS: Record<string, { nature: Nature; type: string }> = {
  pdf: { nature: 'pdf', type: 'application/pdf' },
  png: { nature: 'png', type: 'image/png' },
  jpg: { nature: 'jpeg', type: 'image/jpeg' },
  jpeg: { nature: 'jpeg', type: 'image/jpeg' },
  gif: { nature: 'gif', type: 'image/gif' },
  webp: { nature: 'webp', type: 'image/webp' },
  doc: { nature: 'ole', type: 'application/msword' },
  xls: { nature: 'ole', type: 'application/vnd.ms-excel' },
  docx: { nature: 'docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  xlsx: { nature: 'xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
};

/** Nature réelle d'un fichier, lue dans ses premiers octets (jamais dans son nom ni le type déclaré). */
export function natureDuContenu(b: Buffer): Nature | null {
  const debut = (octets: number[]) => octets.every((o, i) => b[i] === o);
  if (b.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (debut([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (debut([0xff, 0xd8, 0xff])) return 'jpeg';
  if (/^GIF8[79]a/.test(b.subarray(0, 6).toString('latin1'))) return 'gif';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (debut([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'ole';
  if (debut([0x50, 0x4b, 0x03, 0x04])) {
    // Paquet Office : les noms des parties sont écrits en clair dans l'archive.
    const noms = b.toString('latin1');
    if (!noms.includes('[Content_Types].xml')) return null;
    if (noms.includes('word/')) return 'docx';
    if (noms.includes('xl/')) return 'xlsx';
  }
  return null;
}

/**
 * Pièces jointes de la messagerie (S3) : fichier envoyé depuis l'ordinateur (PDF, Word, Excel, images ;
 * 10 Mo ; type vérifié par le contenu ; stockage privé), téléchargé par les deux personnes de la
 * conversation seulement, chaque téléchargement audité ; documents des Archives à citer (droits de la GED).
 */
@Injectable()
export class PiecesJointesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly messages: MessagesService,
    private readonly documents: DocumentsService,
  ) {}

  /** Envoi d'un fichier : la clé de stockage est posée ici, jamais venue du navigateur (S3c). */
  async envoyerFichier(actor: AuthenticatedUser, recipientId: string, texte: string | undefined, f: Express.Multer.File | undefined) {
    if (actor.role === SystemRole.STAGIAIRE) throw new ForbiddenException('L’envoi de fichiers par message n’est pas ouvert aux stagiaires.');
    if (!f) throw new BadRequestException('Choisissez un fichier.');
    if (f.size > TAILLE_MAX_PIECE) throw new PayloadTooLargeException('Fichier trop volumineux : 10 Mo au plus.');
    const nom = (f.originalname || 'fichier').replace(/[\\/]/g, '_').slice(0, 200);
    const ext = nom.includes('.') ? nom.split('.').pop()!.toLowerCase() : '';
    const attendu = EXTENSIONS[ext];
    if (!attendu) throw new BadRequestException('Type de fichier non permis : PDF, Word, Excel ou image (PNG, JPEG, GIF, WebP).');
    if (natureDuContenu(f.buffer) !== attendu.nature) throw new BadRequestException('Le contenu du fichier ne correspond pas à son type : envoi refusé.');
    const destinataire = await this.prisma.user.findUnique({ where: { id: recipientId }, select: { status: true } });
    if (!destinataire || destinataire.status !== 'ACTIF') throw new NotFoundException('Destinataire introuvable');
    const { fileKey } = await this.storage.save(f.buffer, nom);
    try {
      return await this.messages.send(actor, { recipientId, body: (texte ?? '').trim().slice(0, 4000) }, { cle: fileKey, nom });
    } catch (e) {
      await this.storage.delete(fileKey).catch(() => undefined);
      throw e;
    }
  }

  /** Téléchargement : l'expéditeur ou le destinataire, en personne (jamais par intérim) ; audité. */
  async telecharger(actor: AuthenticatedUser, messageId: string) {
    const m = await this.prisma.directMessage.findUnique({ where: { id: messageId }, select: { id: true, senderId: true, recipientId: true, attachmentKey: true, attachmentName: true } });
    if (!m || !m.attachmentKey) throw new NotFoundException('Pièce jointe introuvable');
    if (actor.id !== m.senderId && actor.id !== m.recipientId) throw new ForbiddenException('Cette pièce jointe appartient à une autre conversation.');
    const ext = (m.attachmentName ?? '').split('.').pop()!.toLowerCase();
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'DirectMessage', entityId: m.id, metadata: { event: 'telechargement_piece_jointe' } });
    return { stream: this.storage.createReadStream(m.attachmentKey), nom: m.attachmentName ?? 'piece-jointe', type: EXTENSIONS[ext]?.type ?? (ext === 'pdf' ? 'application/pdf' : null) };
  }

  /**
   * Documents des Archives à citer dans une conversation : ceux que l'acteur peut ouvrir (droits de la
   * GED). Sans texte : déjà échangés avec ce correspondant, puis récents de son unité ; avec texte :
   * moteur de recherche (titre, nom du fichier), sans accents, dès la première lettre.
   */
  async documentsACiter(actor: AuthenticatedUser, autreId: string, q: string | undefined) {
    if (actor.role === SystemRole.STAGIAIRE) throw new ForbiddenException('Les Archives ne sont pas ouvertes aux stagiaires.');
    const visibles = await this.documents.findAllVisibleTo(actor, {});
    const parId = new Map(visibles.map((d) => [d.id, d]));
    const corps = await this.prisma.directMessage.findMany({
      where: { OR: [{ senderId: actor.id, recipientId: autreId }, { senderId: autreId, recipientId: actor.id }], body: { contains: '/documents?id=' } },
      select: { body: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const echanges = documentsCites(corps.map((c) => c.body)).filter((id) => parId.has(id));
    const lieux = new Map(
      (await this.prisma.document.findMany({ where: { id: { in: visibles.map((d) => d.id) } }, select: { id: true, division: { select: { name: true } }, cellule: { select: { name: true } }, folder: { select: { name: true } } } })).map((l) => [l.id, l]),
    );
    const vue = (d: (typeof visibles)[number]) => {
      const l = lieux.get(d.id);
      return {
        id: d.id,
        titre: d.title,
        nomFichier: d.currentVersion?.fileName ?? null,
        version: d.currentVersion?.versionNumber ?? null,
        chemin: ['Archives', l?.division?.name ?? l?.cellule?.name, l?.folder?.name].filter(Boolean).join(' · '),
        echange: echanges.includes(d.id),
      };
    };
    const mots = motsRecherche(q ?? '');
    if (!mots.length) {
      const deMonUnite = visibles.filter((d) => !echanges.includes(d.id) && ((actor.divisionId && d.divisionId === actor.divisionId) || (actor.celluleId && d.celluleId === actor.celluleId)));
      return [...echanges.map((id) => parId.get(id)!), ...deMonUnite].slice(0, 20).map(vue);
    }
    return visibles
      .map((d) => ({ d, s: scoreRecherche(mots, [d.title, d.currentVersion?.fileName]) }))
      .filter((x): x is { d: (typeof visibles)[number]; s: number } => x.s !== null)
      .sort((a, b) => a.s - b.s || (echanges.includes(b.d.id) ? 1 : 0) - (echanges.includes(a.d.id) ? 1 : 0))
      .slice(0, 20)
      .map((x) => vue(x.d));
  }
}
