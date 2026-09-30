import { BadRequestException, Injectable } from '@nestjs/common';
import { CourrierConfidentialite } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { TasksService } from '../tasks/tasks.service';
import { DocumentsService } from '../documents/documents.service';
import { MeetingsService } from '../meetings/meetings.service';
import { ArriveesService } from '../courrier/arrivees.service';
import { ActesService } from '../courrier/actes.service';

export const TYPES_OBJET = ['TACHE', 'DOCUMENT', 'REUNION', 'ARRIVEE', 'ACTE'] as const;
export type TypeObjet = (typeof TYPES_OBJET)[number];

export interface ObjetVu {
  type: TypeObjet;
  id: string;
  libelle: string;
  lien: string;
}

/**
 * Objets de la plateforme qu'on peut citer (pièce jointe d'un fil, socle N5) : chaque type est
 * résolu par le service de son module, avec les mêmes règles de visibilité que son écran. Un objet
 * protégé (pli personnel ; le dossier du personnel et les congés ne sont pas citables) est refusé.
 */
@Injectable()
export class ObjetsPlateformeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly documents: DocumentsService,
    private readonly meetings: MeetingsService,
    private readonly arrivees: ArriveesService,
    private readonly actes: ActesService,
  ) {}

  /** L'objet tel que l'acteur le voit, ou `null` s'il ne le voit pas (aucun détail divulgué). */
  async voir(actor: AuthenticatedUser, type: string, id: string): Promise<ObjetVu | null> {
    try {
      switch (type as TypeObjet) {
        case 'TACHE': {
          const t = await this.tasks.findOneVisibleTo(actor, id);
          return { type: 'TACHE', id, libelle: t.title, lien: `/tasks/${id}` };
        }
        case 'DOCUMENT': {
          const d = await this.documents.findOneVisibleTo(actor, id);
          return { type: 'DOCUMENT', id, libelle: d.title, lien: `/documents?id=${id}` };
        }
        case 'REUNION': {
          const m = await this.meetings.findOneVisibleTo(actor, id);
          return { type: 'REUNION', id, libelle: m.title, lien: `/reunions?id=${id}` };
        }
        case 'ARRIVEE': {
          const a = await this.arrivees.findOne(actor, id);
          if (a.confidentialite === CourrierConfidentialite.PERSONNEL) return null;
          return { type: 'ARRIVEE', id, libelle: a.objet ? `${a.numero} — ${a.objet}` : a.numero, lien: `/courrier?arrivee=${id}` };
        }
        case 'ACTE': {
          const a = await this.actes.findOne(actor, id);
          return { type: 'ACTE', id, libelle: `${a.numero ?? 'Projet d’acte'} — ${a.objet}`, lien: `/courrier?acte=${id}` };
        }
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  /** Contrôle avant de joindre : type connu, objet non protégé, vu par l'auteur. */
  async exigerJoignable(actor: AuthenticatedUser, type: string, id: string): Promise<ObjetVu> {
    if (!TYPES_OBJET.includes(type as TypeObjet)) throw new BadRequestException('Type d’objet inconnu.');
    if (type === 'ARRIVEE') {
      const a = await this.prisma.courrierArrivee.findUnique({ where: { id }, select: { confidentialite: true } });
      if (a?.confidentialite === CourrierConfidentialite.PERSONNEL) throw new BadRequestException('Un pli personnel est protégé : il ne peut pas être joint.');
    }
    const vu = await this.voir(actor, type, id);
    if (!vu) throw new BadRequestException('Objet introuvable ou que vous ne voyez pas : il ne peut pas être joint.');
    return vu;
  }
}
