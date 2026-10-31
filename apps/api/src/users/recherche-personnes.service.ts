import { Injectable } from '@nestjs/common';
import { Prisma, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { motsRecherche, scoreRecherche } from '../common/recherche/texte';

const PERSONNE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  role: true,
  division: { select: { code: true, name: true } },
  section: { select: { code: true, name: true } },
  cellule: { select: { code: true, name: true } },
} satisfies Prisma.UserSelect;
type PersonneLue = Prisma.UserGetPayload<{ select: typeof PERSONNE_SELECT }>;

export interface PersonneTrouvee {
  id: string;
  prenom: string;
  nom: string;
  fonction: string | null;
  /** Sigle de l'unité (section, sinon division ou cellule ; « Direction » pour le DN et la DNA). */
  unite: string | null;
  uniteLibelle: string | null;
  /** Une conversation existe déjà avec cette personne. */
  conversation: boolean;
}

const RECENTS_MAX = 6;
const RESULTATS_MAX = 60;

/**
 * Recherche de personnes (S2) : tout le personnel ACTIF (messagerie sans restriction de cascade,
 * RF-COM-01 ; mêmes champs non sensibles que `/users/search` : ni email, ni téléphone). Sans texte :
 * correspondants récents d'abord, puis tout le personnel ; avec texte : moteur `common/recherche/texte`
 * (sans accents, chaque mot dans prénom, nom, fonction ou sigle d'unité, débuts de mot en premier).
 */
@Injectable()
export class RecherchePersonnesService {
  constructor(private readonly prisma: PrismaService) {}

  static sigle(p: Pick<PersonneLue, 'role' | 'division' | 'section' | 'cellule'>): string | null {
    if (p.role === SystemRole.DN || p.role === SystemRole.DNA) return 'Direction';
    return p.section?.code ?? p.cellule?.code ?? p.division?.code ?? null;
  }

  static libelleUnite(p: Pick<PersonneLue, 'role' | 'division' | 'section' | 'cellule'>): string | null {
    if (p.role === SystemRole.DN || p.role === SystemRole.DNA) return 'Direction nationale';
    if (p.section) return `${p.section.name} · ${p.division?.code ?? ''}`.replace(/ · $/, '');
    return p.cellule?.name ?? p.division?.name ?? null;
  }

  /** Interlocuteurs de l'acteur, du plus récent au plus ancien message. */
  private async correspondants(actor: AuthenticatedUser): Promise<string[]> {
    const lignes = await this.prisma.$queryRaw<{ autre: string }[]>`
      SELECT autre FROM (
        SELECT CASE WHEN "senderId" = ${actor.id} THEN "recipientId" ELSE "senderId" END AS autre, max("createdAt") AS dernier
        FROM direct_messages WHERE "senderId" = ${actor.id} OR "recipientId" = ${actor.id}
        GROUP BY 1
      ) t ORDER BY dernier DESC`;
    return lignes.map((l) => l.autre);
  }

  async rechercher(actor: AuthenticatedUser, q: string | undefined): Promise<{ recents: PersonneTrouvee[]; personnes: PersonneTrouvee[] }> {
    const [tous, correspondants] = await Promise.all([
      this.prisma.user.findMany({ where: { status: UserStatus.ACTIF, id: { not: actor.id } }, select: PERSONNE_SELECT, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
      this.correspondants(actor),
    ]);
    const rang = new Map(correspondants.map((id, i) => [id, i]));
    const vue = (p: PersonneLue): PersonneTrouvee => ({
      id: p.id,
      prenom: p.firstName,
      nom: p.lastName,
      fonction: p.jobTitle,
      unite: RecherchePersonnesService.sigle(p),
      uniteLibelle: RecherchePersonnesService.libelleUnite(p),
      conversation: rang.has(p.id),
    });
    const mots = motsRecherche(q ?? '');
    if (!mots.length) {
      const recents = tous.filter((p) => rang.has(p.id)).sort((a, b) => rang.get(a.id)! - rang.get(b.id)!).slice(0, RECENTS_MAX);
      const pris = new Set(recents.map((p) => p.id));
      return { recents: recents.map(vue), personnes: tous.filter((p) => !pris.has(p.id)).map(vue) };
    }
    const trouves = tous
      .map((p) => ({ p, s: scoreRecherche(mots, [p.firstName, p.lastName, p.jobTitle, RecherchePersonnesService.sigle(p), p.division?.code, p.cellule?.code]) }))
      .filter((x): x is { p: PersonneLue; s: number } => x.s !== null)
      .sort((a, b) => a.s - b.s || (rang.get(a.p.id) ?? 1e9) - (rang.get(b.p.id) ?? 1e9))
      .slice(0, RESULTATS_MAX);
    return { recents: [], personnes: trouves.map((x) => vue(x.p)) };
  }
}
