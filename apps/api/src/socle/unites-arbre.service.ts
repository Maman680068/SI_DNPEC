import { Injectable } from '@nestjs/common';
import { TypeUnite } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NoeudUnite {
  id: string;
  code: string;
  libelle: string;
  type: TypeUnite;
  parentId: string | null;
  responsableId: string | null;
  dateFermeture: Date | null;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
}

/** Arbre des unités, chargé une fois et gardé quelques secondes (quelques dizaines d'unités). */
export interface Arbre {
  parId: Map<string, NoeudUnite>;
  enfants: Map<string, string[]>;
  direction: NoeudUnite | null;
  parDivision: Map<string, NoeudUnite>;
  parSection: Map<string, NoeudUnite>;
  parCellule: Map<string, NoeudUnite>;
}

const DUREE_CACHE_MS = 5000;

/**
 * Lecture de l'organigramme (socle NIMBA, §3) partagée par le calcul du
 * périmètre, l'écran Organisation et la reprise. Invalidée à chaque écriture
 * d'unité (UnitesService, ReprisesN1Service).
 */
@Injectable()
export class UnitesArbreService {
  private cache: { arbre: Arbre; expire: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  invalider(): void {
    this.cache = null;
  }

  async arbre(): Promise<Arbre> {
    if (this.cache && this.cache.expire > Date.now()) return this.cache.arbre;
    const unites = await this.prisma.uniteOrganisationnelle.findMany({
      select: {
        id: true, code: true, libelle: true, type: true, parentId: true, responsableId: true,
        dateFermeture: true, divisionId: true, sectionId: true, celluleId: true,
      },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });
    const arbre: Arbre = {
      parId: new Map(), enfants: new Map(), direction: null,
      parDivision: new Map(), parSection: new Map(), parCellule: new Map(),
    };
    for (const u of unites) {
      arbre.parId.set(u.id, u);
      if (u.parentId) arbre.enfants.set(u.parentId, [...(arbre.enfants.get(u.parentId) ?? []), u.id]);
      if (u.type === TypeUnite.DIRECTION && !u.parentId) arbre.direction = u;
      if (u.divisionId) arbre.parDivision.set(u.divisionId, u);
      if (u.sectionId) arbre.parSection.set(u.sectionId, u);
      if (u.celluleId) arbre.parCellule.set(u.celluleId, u);
    }
    this.cache = { arbre, expire: Date.now() + DUREE_CACHE_MS };
    return arbre;
  }

  /** L'unité et toutes ses sous-unités (ouvertes ou fermées). */
  descendants(arbre: Arbre, uniteId: string): Set<string> {
    const out = new Set<string>();
    const pile = [uniteId];
    while (pile.length) {
      const id = pile.pop()!;
      if (out.has(id)) continue;
      out.add(id);
      pile.push(...(arbre.enfants.get(id) ?? []));
    }
    return out;
  }

  /** Unité correspondant à un rattachement historique (section, sinon division, sinon cellule). */
  uniteDuRattachement(
    arbre: Arbre,
    r: { divisionId: string | null; sectionId: string | null; celluleId: string | null },
  ): NoeudUnite | null {
    if (r.sectionId && arbre.parSection.has(r.sectionId)) return arbre.parSection.get(r.sectionId)!;
    if (r.divisionId && arbre.parDivision.has(r.divisionId)) return arbre.parDivision.get(r.divisionId)!;
    if (r.celluleId && arbre.parCellule.has(r.celluleId)) return arbre.parCellule.get(r.celluleId)!;
    return null;
  }

  /** Chemin de l'unité à la racine (unité comprise), du plus proche au plus lointain. */
  ascendants(arbre: Arbre, uniteId: string): NoeudUnite[] {
    const out: NoeudUnite[] = [];
    let courant = arbre.parId.get(uniteId) ?? null;
    while (courant && out.length < 50) {
      out.push(courant);
      courant = courant.parentId ? arbre.parId.get(courant.parentId) ?? null : null;
    }
    return out;
  }
}
