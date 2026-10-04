import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { TasksService } from '../../tasks/tasks.service';
import { TaskFiltersDto } from '../../tasks/dto/task-filters.dto';
import { DocumentsService } from '../../documents/documents.service';
import { ROLE_LIBELLE } from '../../role-change/roles';

/** Renvoi vers un document des Archives dans le corps d'un message (lien de la page « /documents?id= »). */
const MOTIF_DOCUMENT = /\/documents\?id=([A-Za-z0-9_-]{1,64})/g;
/** Au plus autant de documents cités examinés (les plus récents d'abord). */
const DOCUMENTS_MAX = 30;
const TACHES_MAX = 10;

/** Identifiants des documents cités dans des corps de messages, du plus récent au plus ancien, sans doublon. */
export function documentsCites(corps: string[]): string[] {
  const ids: string[] = [];
  for (const c of corps) for (const m of c.matchAll(MOTIF_DOCUMENT)) if (!ids.includes(m[1]!)) ids.push(m[1]!);
  return ids;
}

/**
 * Fiche de l'interlocuteur d'une conversation directe (refonte de l'interface, étape 6) : qui il est
 * (fonction, unité — ce que l'annuaire montre déjà), les documents des Archives cités dans la
 * conversation que le LECTEUR peut ouvrir (même règle que la GED : `DocumentsService.findOneVisibleTo` ;
 * la GED est fermée aux stagiaires, donc aucun document pour eux) et les tâches où les deux personnes
 * sont créateur ou assignées, filtrées par la visibilité du lecteur (`TasksService.findAllVisibleTo`).
 * Rien n'est renvoyé sur un objet que le lecteur ne voit pas, pas même son existence.
 */
@Injectable()
export class ContexteConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly documents: DocumentsService,
  ) {}

  async contexte(actor: AuthenticatedUser, autreId: string) {
    if (autreId === actor.id) throw new BadRequestException('Une conversation se tient avec une autre personne.');
    const autre = await this.prisma.user.findUnique({
      where: { id: autreId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        jobTitle: true,
        division: { select: { name: true } },
        section: { select: { name: true } },
        cellule: { select: { name: true } },
      },
    });
    if (!autre) throw new NotFoundException('Interlocuteur introuvable.');

    const [documents, taches] = await Promise.all([this.documentsVisibles(actor, autreId), this.tachesEnCommun(actor, autreId)]);
    return {
      interlocuteur: {
        id: autre.id,
        prenom: autre.firstName,
        nom: autre.lastName,
        fonction: autre.jobTitle?.trim() || ROLE_LIBELLE[autre.role],
        unite: [autre.section?.name, autre.division?.name ?? autre.cellule?.name].filter(Boolean).join(' · ') || null,
      },
      documents,
      taches,
    };
  }

  private async documentsVisibles(actor: AuthenticatedUser, autreId: string) {
    // La GED (et donc l'ouverture d'un document) est fermée aux stagiaires.
    if (actor.role === SystemRole.STAGIAIRE) return [];
    const messages = await this.prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: actor.id, recipientId: autreId },
          { senderId: autreId, recipientId: actor.id },
        ],
        body: { contains: '/documents?id=' },
      },
      select: { body: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const ids = documentsCites(messages.map((m) => m.body)).slice(0, DOCUMENTS_MAX);
    const vus = [];
    for (const id of ids) {
      const d = await this.documents.findOneVisibleTo(actor, id).catch(() => null);
      if (!d) continue;
      const lieu = await this.prisma.document.findUnique({
        where: { id },
        select: { division: { select: { name: true } }, cellule: { select: { name: true } }, folder: { select: { name: true } } },
      });
      vus.push({
        id: d.id,
        titre: d.title,
        nomFichier: d.currentVersion?.fileName ?? null,
        version: d.currentVersion?.versionNumber ?? null,
        chemin: ['Archives', lieu?.division?.name ?? lieu?.cellule?.name, lieu?.folder?.name].filter(Boolean).join(' · '),
        lien: `/documents?id=${d.id}`,
      });
    }
    return vus;
  }

  private async tachesEnCommun(actor: AuthenticatedUser, autreId: string) {
    const filtre = (f: Partial<TaskFiltersDto>) => this.tasks.findAllVisibleTo(actor, Object.assign(new TaskFiltersDto(), { limite: 200, ...f }));
    const [assigneesAutre, creeesAutre] = await Promise.all([filtre({ assigneeId: autreId }), filtre({ createdById: autreId })]);
    const avecMoi = (t: { createdById: string; assignees: { userId: string }[] }) => t.createdById === actor.id || t.assignees.some((a) => a.userId === actor.id);
    const vues = new Map<string, (typeof assigneesAutre)[number]>();
    for (const t of [...assigneesAutre.filter(avecMoi), ...creeesAutre.filter((t) => t.assignees.some((a) => a.userId === actor.id))]) vues.set(t.id, t);
    return [...vues.values()]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, TACHES_MAX)
      .map((t) => ({ id: t.id, titre: t.title, statut: t.status, echeance: t.dueDate, lien: `/tasks/${t.id}` }));
  }
}
