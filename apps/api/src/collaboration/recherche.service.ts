import { Injectable } from '@nestjs/common';
import { CourrierConfidentialite, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { TasksService } from '../tasks/tasks.service';
import { DocumentsService } from '../documents/documents.service';
import { DocumentFiltersDto } from '../documents/dto/document-filters.dto';
import { MeetingsService } from '../meetings/meetings.service';
import { ArriveesService } from '../courrier/arrivees.service';
import { ActesService } from '../courrier/actes.service';
import { ArriveeFiltresDto } from '../courrier/dto/arrivee.dto';
import { ActeFiltresDto } from '../courrier/dto/acte.dto';

const PAR_CATEGORIE = 5;

export interface Resultat {
  id: string;
  libelle: string;
  detail: string | null;
  lien: string;
}

/**
 * Recherche transverse (socle N5, A2.8) : chaque catégorie passe par la requête de son module, avec
 * les mêmes règles de visibilité que son écran — aucun droit propre à la recherche, administrateur
 * compris. Aucun objet protégé (pli personnel ; dossier du personnel, congés et instructions ne sont
 * pas cherchés). 5 résultats par catégorie, avec le total trouvé.
 */
@Injectable()
export class RechercheService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly documents: DocumentsService,
    private readonly meetings: MeetingsService,
    private readonly arrivees: ArriveesService,
    private readonly actes: ActesService,
  ) {}

  async rechercher(actor: AuthenticatedUser, texte: string) {
    const q = texte.trim();
    const n = PAR_CATEGORIE + 1; // un de plus : « d'autres résultats » sans tout compter
    const dateFr = (d: Date | null) => (d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null);
    const [taches, documents, reunions, arrivees, actes, annuaire] = await Promise.all([
      this.tasks.rechercher(actor, q, n).then((l) => l.map((t) => ({ id: t.id, libelle: t.title, detail: t.dueDate ? `Échéance ${dateFr(t.dueDate)}` : null, lien: `/tasks/${t.id}` }))),
      this.documents.findAllVisibleTo(actor, Object.assign(new DocumentFiltersDto(), { q })).then((l) => l.slice(0, n).map((d) => ({ id: d.id, libelle: d.title, detail: dateFr(d.createdAt), lien: `/documents?id=${d.id}` }))),
      this.meetings.rechercher(actor, q, n).then((l) => l.map((m) => ({ id: m.id, libelle: m.title, detail: dateFr(m.startAt), lien: `/reunions?id=${m.id}` }))),
      this.arrivees.lister(actor, Object.assign(new ArriveeFiltresDto(), { q })).then((l) =>
        l.filter((a) => a.confidentialite !== CourrierConfidentialite.PERSONNEL).slice(0, n).map((a) => ({ id: a.id, libelle: a.objet ? `${a.numero} — ${a.objet}` : a.numero, detail: a.expediteur, lien: `/courrier?arrivee=${a.id}` })),
      ),
      this.actes.lister(actor, Object.assign(new ActeFiltresDto(), { q })).then((l) => l.slice(0, n).map((a) => ({ id: a.id, libelle: `${a.numero ?? 'Projet'} — ${a.objet}`, detail: a.destinataires ?? null, lien: `/courrier?acte=${a.id}` }))),
      this.annuaire(q, n),
    ]);
    const categorie = (cle: string, libelle: string, l: Resultat[]) => ({ cle, libelle, resultats: l.slice(0, PAR_CATEGORIE), autres: l.length > PAR_CATEGORIE });
    return {
      q,
      categories: [
        categorie('taches', 'Tâches', taches),
        categorie('documents', 'Documents', documents),
        categorie('courrier', 'Courrier', [...arrivees, ...actes]),
        categorie('annuaire', 'Annuaire', annuaire),
        categorie('reunions', 'Réunions', reunions),
      ],
    };
  }

  /** Annuaire : mêmes données que l'écran Annuaire (personnel actif, nom et fonction). */
  private async annuaire(q: string, take: number): Promise<Resultat[]> {
    const mots = q.split(/\s+/).filter(Boolean);
    const l = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIF,
        AND: mots.map((m) => ({ OR: [{ firstName: { contains: m, mode: 'insensitive' as const } }, { lastName: { contains: m, mode: 'insensitive' as const } }, { jobTitle: { contains: m, mode: 'insensitive' as const } }] })),
      },
      select: { id: true, firstName: true, lastName: true, jobTitle: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take,
    });
    return l.map((u) => {
      const nom = encodeURIComponent(`${u.firstName} ${u.lastName}`);
      return { id: u.id, libelle: `${u.firstName} ${u.lastName}`, detail: u.jobTitle, lien: `/annuaire?q=${nom}` };
    });
  }
}
