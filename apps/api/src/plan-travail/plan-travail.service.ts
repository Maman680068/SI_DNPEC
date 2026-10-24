import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, SystemRole, TaskStatus, TypeUnite, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { CascadeService } from '../org/cascade/cascade.service';
import { lireReference, referenceActivite } from '../common/references/references';
import { ActiviteDto, ModifierActiviteDto, ModifierObjectifDto, ObjectifDto, PlanFiltresDto } from './dto/plan-travail.dto';

type Unite = { id: string; type: TypeUnite; parentId: string | null; libelle: string; code: string; divisionId: string | null; sectionId: string | null; celluleId: string | null; dateFermeture: Date | null };
const UNITE_SELECT = { id: true, type: true, parentId: true, libelle: true, code: true, divisionId: true, sectionId: true, celluleId: true, dateFermeture: true } satisfies Prisma.UniteOrganisationnelleSelect;
const ACTIVITE_SELECT = {
  id: true,
  objectifId: true,
  annee: true,
  numero: true,
  libelle: true,
  responsableId: true,
  responsable: { select: { id: true, firstName: true, lastName: true } },
  dateDebut: true,
  dateFin: true,
  indicateur: true,
  cible: true,
  createdAt: true,
} satisfies Prisma.ActiviteSelect;
type ActiviteChargee = Prisma.ActiviteGetPayload<{ select: typeof ACTIVITE_SELECT }>;
const jour = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00.000Z`);
const LIEN = (id: string) => `/plan-travail?activite=${id}`;

/**
 * Plan de travail (socle N5, SIG-RF-PTA) : objectif → activité datée (responsable, indicateur) →
 * tâches. L'avancement d'une activité est calculé (moyenne de ses tâches principales, elles-mêmes
 * calculées en base, N3) ; celui d'un objectif, la moyenne de ses activités. Droits par unité du
 * socle : le chef d'une unité gère son plan (le chef de division aussi celui de ses sections), le DN
 * et la DNA toute la Direction ; chacun lit le plan de son unité et des unités au-dessus.
 */
@Injectable()
export class PlanTravailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly cascade: CascadeService,
  ) {}

  // ------------------------------------------------------------------ périmètres

  private async unites(): Promise<Unite[]> {
    return this.prisma.uniteOrganisationnelle.findMany({ select: UNITE_SELECT });
  }

  private direction(actor: AuthenticatedUser) {
    return actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
  }

  private sousArbre(toutes: Unite[], racine: Unite): Unite[] {
    const res = [racine];
    for (let i = 0; i < res.length; i++) for (const u of toutes) if (u.parentId === res[i]!.id) res.push(u);
    return res;
  }

  private uniteDe(toutes: Unite[], r: { divisionId: string | null; sectionId: string | null; celluleId: string | null }): Unite | undefined {
    return (r.sectionId && toutes.find((u) => u.sectionId === r.sectionId)) || (r.celluleId && toutes.find((u) => u.celluleId === r.celluleId)) || (r.divisionId && toutes.find((u) => u.divisionId === r.divisionId)) || undefined;
  }

  /** Unités dont l'acteur gère le plan. */
  private gerees(actor: AuthenticatedUser, toutes: Unite[]): Unite[] {
    if (this.direction(actor)) return toutes;
    const propre = this.uniteDe(toutes, actor);
    if (!propre) return [];
    if (actor.role === SystemRole.CHEF_DIVISION && propre.type === TypeUnite.DIVISION) return this.sousArbre(toutes, propre);
    if (actor.role === SystemRole.CHEF_DIVISION && propre.type === TypeUnite.SECTION) {
      const div = toutes.find((u) => u.id === propre.parentId);
      return div ? this.sousArbre(toutes, div) : [];
    }
    if ((actor.role === SystemRole.CHEF_SECTION && propre.type === TypeUnite.SECTION) || (actor.role === SystemRole.CHEF_CELLULE && propre.type === TypeUnite.CELLULE)) return [propre];
    return [];
  }

  /** Unités dont l'acteur lit le plan : les siennes et celles au-dessus, et celles qu'il gère.
   * L'assistant de direction lit comme son superviseur (visibilité seulement, jamais la gestion). */
  private visibles(acteur: AuthenticatedUser, toutes: Unite[]): Set<string> {
    const actor = this.cascade.getVisibilityActor(acteur);
    if (this.direction(actor)) return new Set(toutes.map((u) => u.id));
    const ids = new Set(this.gerees(actor, toutes).map((u) => u.id));
    let u = this.uniteDe(toutes, actor) ?? toutes.find((x) => x.type === TypeUnite.DIRECTION);
    while (u) {
      ids.add(u.id);
      u = u.parentId ? toutes.find((x) => x.id === u!.parentId) : undefined;
    }
    for (const d of toutes.filter((x) => x.type === TypeUnite.DIRECTION)) ids.add(d.id);
    return ids;
  }

  /** Membres actifs (hors stagiaires) d'une unité et de ses sous-unités — responsables possibles. */
  private async membres(toutes: Unite[], unite: Unite) {
    const arbre = this.sousArbre(toutes, unite);
    const where: Prisma.UserWhereInput =
      unite.type === TypeUnite.DIRECTION
        ? {}
        : {
            OR: [
              { divisionId: { in: arbre.map((u) => u.divisionId).filter((x): x is string => !!x) } },
              { sectionId: { in: arbre.map((u) => u.sectionId).filter((x): x is string => !!x) } },
              { celluleId: { in: arbre.map((u) => u.celluleId).filter((x): x is string => !!x) } },
            ],
          };
    return this.prisma.user.findMany({
      where: { AND: [where, { status: UserStatus.ACTIF, role: { not: SystemRole.STAGIAIRE } }] },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  // ------------------------------------------------------------------ lecture

  async plan(actor: AuthenticatedUser, f: PlanFiltresDto) {
    const annee = f.annee ?? new Date().getUTCFullYear();
    const toutes = await this.unites();
    const visibles = this.visibles(actor, toutes);
    const gerees = new Set(this.gerees(actor, toutes).map((u) => u.id));
    if (f.uniteId && !visibles.has(f.uniteId)) throw new ForbiddenException('Plan de travail hors de votre périmètre.');
    const uniteIds = f.uniteId ? [f.uniteId] : [...visibles];
    const objectifs = await this.prisma.objectif.findMany({
      where: { annee, uniteId: { in: uniteIds } },
      include: { activites: { select: ACTIVITE_SELECT, orderBy: { dateDebut: 'asc' } } },
      orderBy: [{ createdAt: 'asc' }],
    });
    const avancements = await this.avancements(objectifs.flatMap((o) => o.activites.map((a) => a.id)));
    const libelle = (id: string) => toutes.find((u) => u.id === id)?.libelle ?? '';
    const sigle = (id: string) => toutes.find((u) => u.id === id)?.code ?? '';
    return {
      annee,
      unites: toutes.filter((u) => visibles.has(u.id) && !u.dateFermeture).map((u) => ({ id: u.id, libelle: u.libelle, type: u.type, gere: gerees.has(u.id) })),
      peutCreer: gerees.size > 0,
      objectifs: objectifs.map((o) => {
        const acts = o.activites.map((a) => ({ ...this.vueActivite(a, avancements, gerees.has(o.uniteId)), uniteSigle: sigle(o.uniteId) }));
        return {
          id: o.id,
          annee: o.annee,
          uniteId: o.uniteId,
          unite: libelle(o.uniteId),
          uniteSigle: sigle(o.uniteId),
          libelle: o.libelle,
          description: o.description,
          avancement: acts.length ? Math.round(acts.reduce((s, a) => s + a.avancement, 0) / acts.length) : 0,
          activites: acts,
          droits: { modifier: gerees.has(o.uniteId), supprimer: gerees.has(o.uniteId) && acts.length === 0, ajouterActivite: gerees.has(o.uniteId) },
        };
      }),
    };
  }

  async activite(actor: AuthenticatedUser, id: string) {
    const { activite, objectif, gere } = await this.chargerActivite(actor, id);
    const avancements = await this.avancements([id]);
    const taches = await this.prisma.task.findMany({
      where: { activiteId: id, parentTaskId: null },
      select: { id: true, title: true, status: true, progressPercent: true, dueDate: true },
      orderBy: [{ dueDate: 'asc' }],
    });
    const toutes = await this.unites();
    const unite = toutes.find((u) => u.id === objectif.uniteId)!;
    return {
      ...this.vueActivite(activite, avancements, gere),
      objectif: { id: objectif.id, libelle: objectif.libelle, unite: unite.libelle, annee: objectif.annee },
      taches,
      responsablesPossibles: gere ? await this.membres(toutes, unite) : [],
    };
  }

  /** Activités auxquelles l'acteur peut rattacher une tâche (plans visibles, activités non closes). */
  async activitesDisponibles(actor: AuthenticatedUser) {
    const toutes = await this.unites();
    const visibles = [...this.visibles(actor, toutes)];
    const limite = new Date(Date.now() - 31 * 864e5);
    const acts = await this.prisma.activite.findMany({
      where: { objectif: { uniteId: { in: visibles } }, dateFin: { gte: limite } },
      select: { id: true, libelle: true, dateFin: true, objectif: { select: { libelle: true, annee: true, uniteId: true } } },
      orderBy: [{ dateFin: 'asc' }],
      take: 300,
    });
    return acts.map((a) => ({ id: a.id, libelle: a.libelle, objectif: a.objectif.libelle, unite: toutes.find((u) => u.id === a.objectif.uniteId)?.libelle ?? '', dateFin: a.dateFin }));
  }

  async responsablesPossibles(actor: AuthenticatedUser, uniteId: string) {
    const toutes = await this.unites();
    const unite = toutes.find((u) => u.id === uniteId);
    if (!unite) throw new NotFoundException('Unité introuvable');
    if (!this.gerees(actor, toutes).some((u) => u.id === uniteId)) throw new ForbiddenException('Vous ne gérez pas le plan de cette unité.');
    return this.membres(toutes, unite);
  }

  /** L'acteur voit-il l'activité (pour y rattacher une tâche) ? */
  async assertActiviteVisible(actor: AuthenticatedUser, activiteId: string): Promise<void> {
    await this.chargerActivite(actor, activiteId);
  }

  // ------------------------------------------------------------------ écriture

  async creerObjectif(actor: AuthenticatedUser, dto: ObjectifDto) {
    await this.assertGere(actor, dto.uniteId);
    const o = await this.prisma.objectif.create({ data: { annee: dto.annee, uniteId: dto.uniteId, libelle: dto.libelle.trim(), description: dto.description?.trim() || null, creeParId: actor.id } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'Objectif', entityId: o.id, metadata: { annee: o.annee, uniteId: o.uniteId } });
    return o;
  }

  async modifierObjectif(actor: AuthenticatedUser, id: string, dto: ModifierObjectifDto) {
    const o = await this.chargerObjectif(id);
    await this.assertGere(actor, o.uniteId);
    const m = await this.prisma.objectif.update({ where: { id }, data: { libelle: dto.libelle?.trim(), description: dto.description === undefined ? undefined : dto.description.trim() || null } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Objectif', entityId: id, metadata: { champs: Object.keys(dto) } });
    return m;
  }

  async supprimerObjectif(actor: AuthenticatedUser, id: string) {
    const o = await this.chargerObjectif(id);
    await this.assertGere(actor, o.uniteId);
    if (await this.prisma.activite.count({ where: { objectifId: id } })) throw new ConflictException('Supprimez d’abord les activités de cet objectif.');
    await this.prisma.objectif.delete({ where: { id } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.SUPPRESSION, entityType: 'Objectif', entityId: id, metadata: { libelle: o.libelle } });
    return { supprime: true };
  }

  async creerActivite(actor: AuthenticatedUser, objectifId: string, dto: ActiviteDto) {
    const o = await this.chargerObjectif(objectifId);
    await this.assertGere(actor, o.uniteId);
    await this.assertResponsable(o.uniteId, dto.responsableId);
    this.assertDates(dto.dateDebut, dto.dateFin);
    // Numéro « A-07 » : suivant de l'année du plan, attribué sous verrou (deux créations simultanées
    // n'obtiennent jamais le même numéro ; l'index unique (annee, numero) en reste le garde-fou).
    const a = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('activites.numero'), ${o.annee}::int)`;
      const dernier = await tx.activite.aggregate({ where: { annee: o.annee }, _max: { numero: true } });
      return tx.activite.create({
        data: { objectifId, annee: o.annee, numero: (dernier._max.numero ?? 0) + 1, libelle: dto.libelle.trim(), responsableId: dto.responsableId, dateDebut: jour(dto.dateDebut), dateFin: jour(dto.dateFin), indicateur: dto.indicateur.trim(), cible: dto.cible?.trim() || null, creeParId: actor.id },
      });
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'Activite', entityId: a.id, metadata: { objectifId, responsableId: a.responsableId } });
    if (a.responsableId !== actor.id) {
      await this.notifications.notify(a.responsableId, 'TACHE_ASSIGNEE', 'Vous êtes responsable d’une activité du plan de travail', `${a.libelle} — du ${a.dateDebut.toISOString().slice(0, 10)} au ${a.dateFin.toISOString().slice(0, 10)}.`, LIEN(a.id), undefined, { libelleBouton: 'Voir l’activité' });
    }
    return a;
  }

  async modifierActivite(actor: AuthenticatedUser, id: string, dto: ModifierActiviteDto) {
    const { activite, objectif, gere } = await this.chargerActivite(actor, id);
    if (!gere) throw new ForbiddenException('Vous ne gérez pas le plan de cette unité.');
    if (dto.responsableId) await this.assertResponsable(objectif.uniteId, dto.responsableId);
    this.assertDates(dto.dateDebut ?? activite.dateDebut.toISOString(), dto.dateFin ?? activite.dateFin.toISOString());
    const a = await this.prisma.activite.update({
      where: { id },
      data: {
        libelle: dto.libelle?.trim(),
        responsableId: dto.responsableId,
        dateDebut: dto.dateDebut ? jour(dto.dateDebut) : undefined,
        dateFin: dto.dateFin ? jour(dto.dateFin) : undefined,
        indicateur: dto.indicateur?.trim(),
        cible: dto.cible === undefined ? undefined : dto.cible.trim() || null,
      },
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Activite', entityId: id, metadata: { champs: Object.keys(dto) } });
    return a;
  }

  async supprimerActivite(actor: AuthenticatedUser, id: string) {
    const { activite, gere } = await this.chargerActivite(actor, id);
    if (!gere) throw new ForbiddenException('Vous ne gérez pas le plan de cette unité.');
    if (await this.prisma.task.count({ where: { activiteId: id } })) throw new ConflictException('Des tâches sont rattachées à cette activité : détachez-les d’abord.');
    await this.prisma.activite.delete({ where: { id } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.SUPPRESSION, entityType: 'Activite', entityId: id, metadata: { libelle: activite.libelle } });
    return { supprime: true };
  }

  /**
   * Tableau de bord de la Direction (DN, DNA) : toutes les activités de la DNPEC de l'année, de la plus en
   * retard à la plus avancée (en retard, puis en dessous du temps écoulé, puis par écart au temps écoulé),
   * avec le sigle de leur unité ; les `limite` premières et le total. 403 pour tout autre profil.
   */
  async avancementDirection(actor: AuthenticatedUser, annee: number, limite: number) {
    if (!this.direction(actor)) throw new ForbiddenException('Vue réservée au DN et à la DNA.');
    const p = await this.plan(actor, { annee } as PlanFiltresDto);
    const rang = { EN_RETARD: 0, EN_DECALAGE: 1, CONFORME: 2 } as const;
    const toutes = p.objectifs
      .flatMap((o) => o.activites)
      .sort((a, b) => rang[a.etatAvancement] - rang[b.etatAvancement] || a.avancement - a.tempsEcoule - (b.avancement - b.tempsEcoule) || a.avancement - b.avancement);
    return { annee, total: toutes.length, activites: toutes.slice(0, limite) };
  }

  /** Recherche transverse : activités des plans visibles, par libellé ou par référence (« A-07 », « a7 », « 7 »). */
  async rechercher(actor: AuthenticatedUser, q: string, take: number) {
    const toutes = await this.unites();
    const visibles = [...this.visibles(actor, toutes)];
    const ref = lireReference(q);
    const acts = await this.prisma.activite.findMany({
      where: {
        objectif: { uniteId: { in: visibles } },
        OR: [{ libelle: { contains: q, mode: 'insensitive' } }, ...(ref && ref.lettre !== 'T' ? [{ numero: ref.numero }] : [])],
      },
      select: { id: true, numero: true, annee: true, libelle: true, objectif: { select: { uniteId: true } } },
      orderBy: [{ annee: 'desc' }, { numero: 'asc' }],
      take,
    });
    const sigle = (id: string) => toutes.find((u) => u.id === id)?.code ?? '';
    return acts.map((a) => ({ id: a.id, reference: referenceActivite(a.numero), libelle: a.libelle, annee: a.annee, uniteSigle: sigle(a.objectif.uniteId), lien: LIEN(a.id) }));
  }

  // ------------------------------------------------------------------ rapport d'activité (N4)

  /** Activités d'un périmètre recoupant une période, avec leur avancement, pour le rapport d'activité. */
  async activitesDuPerimetre(perimetre: { responsableId?: string; divisionId?: string; sectionId?: string; celluleId?: string; direction?: boolean }, debut: Date, fin: Date) {
    const toutes = await this.unites();
    let uniteIds: string[] | undefined;
    const cible = perimetre.sectionId ? toutes.find((u) => u.sectionId === perimetre.sectionId) : perimetre.celluleId ? toutes.find((u) => u.celluleId === perimetre.celluleId) : perimetre.divisionId ? toutes.find((u) => u.divisionId === perimetre.divisionId) : undefined;
    if (cible) uniteIds = this.sousArbre(toutes, cible).map((u) => u.id);
    const acts = await this.prisma.activite.findMany({
      where: {
        dateDebut: { lte: fin },
        dateFin: { gte: debut },
        ...(perimetre.responsableId ? { responsableId: perimetre.responsableId } : {}),
        ...(uniteIds ? { objectif: { uniteId: { in: uniteIds } } } : {}),
      },
      select: { ...ACTIVITE_SELECT, objectif: { select: { libelle: true } } },
      orderBy: [{ dateFin: 'asc' }],
    });
    const av = await this.avancements(acts.map((a) => a.id));
    return acts.map((a) => ({ ...this.vueActivite(a, av, false), objectif: a.objectif.libelle }));
  }

  // ------------------------------------------------------------------ interne

  private async avancements(ids: string[]): Promise<Map<string, { moyenne: number; nombre: number }>> {
    if (!ids.length) return new Map();
    const g = await this.prisma.task.groupBy({ by: ['activiteId'], where: { activiteId: { in: ids }, parentTaskId: null }, _avg: { progressPercent: true }, _count: { _all: true } });
    return new Map(g.map((x) => [x.activiteId!, { moyenne: Math.round(x._avg.progressPercent ?? 0), nombre: x._count._all }]));
  }

  /**
   * Avancement comparé au temps (tableau de bord) : EN_RETARD si l'échéance est passée sans 100 % ;
   * EN_DECALAGE si l'avancement est en dessous de la part du temps écoulée entre le début et la fin ;
   * CONFORME sinon. Calculé ici, jamais par l'écran.
   */
  private etatAvancement(a: { dateDebut: Date; dateFin: Date }, avancement: number, enRetard: boolean, auj: Date) {
    const duree = a.dateFin.getTime() - a.dateDebut.getTime();
    const ecoule = duree <= 0 ? (auj >= a.dateFin ? 100 : 0) : Math.round((100 * (auj.getTime() - a.dateDebut.getTime())) / duree);
    const tempsEcoule = Math.max(0, Math.min(100, ecoule));
    return { tempsEcoule, etatAvancement: enRetard ? 'EN_RETARD' : avancement < tempsEcoule ? 'EN_DECALAGE' : 'CONFORME' } as const;
  }

  private vueActivite(a: ActiviteChargee, av: Map<string, { moyenne: number; nombre: number }>, gere: boolean) {
    const x = av.get(a.id) ?? { moyenne: 0, nombre: 0 };
    const auj = new Date(new Date().toISOString().slice(0, 10));
    const enRetard = a.dateFin < auj && x.moyenne < 100;
    return {
      id: a.id,
      objectifId: a.objectifId,
      numero: a.numero,
      reference: referenceActivite(a.numero),
      libelle: a.libelle,
      responsable: { id: a.responsable.id, nom: `${a.responsable.firstName} ${a.responsable.lastName}` },
      dateDebut: a.dateDebut,
      dateFin: a.dateFin,
      indicateur: a.indicateur,
      cible: a.cible,
      avancement: x.moyenne,
      nombreTaches: x.nombre,
      enRetard,
      ...this.etatAvancement(a, x.moyenne, enRetard, auj),
      droits: { modifier: gere, supprimer: gere && x.nombre === 0 },
    };
  }

  private async chargerObjectif(id: string) {
    const o = await this.prisma.objectif.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('Objectif introuvable');
    return o;
  }

  private async chargerActivite(actor: AuthenticatedUser, id: string) {
    const activite = await this.prisma.activite.findUnique({ where: { id }, select: ACTIVITE_SELECT });
    if (!activite) throw new NotFoundException('Activité introuvable');
    const objectif = await this.chargerObjectif(activite.objectifId);
    const toutes = await this.unites();
    const visible = this.visibles(actor, toutes).has(objectif.uniteId) || activite.responsableId === actor.id;
    if (!visible) throw new ForbiddenException('Activité hors de votre périmètre.');
    return { activite, objectif, gere: this.gerees(actor, toutes).some((u) => u.id === objectif.uniteId) };
  }

  private async assertGere(actor: AuthenticatedUser, uniteId: string) {
    const toutes = await this.unites();
    const u = toutes.find((x) => x.id === uniteId);
    if (!u) throw new NotFoundException('Unité introuvable');
    if (u.dateFermeture) throw new ConflictException('Unité fermée.');
    if (!this.gerees(actor, toutes).some((x) => x.id === uniteId)) throw new ForbiddenException('Le plan de travail d’une unité est géré par son chef (et le DN, la DNA).');
  }

  private async assertResponsable(uniteId: string, responsableId: string) {
    const toutes = await this.unites();
    const unite = toutes.find((u) => u.id === uniteId)!;
    if (!(await this.membres(toutes, unite)).some((m) => m.id === responsableId)) throw new BadRequestException('Le responsable doit être un membre actif de l’unité.');
  }

  private assertDates(debut: string, fin: string) {
    if (jour(fin) < jour(debut)) throw new BadRequestException('La fin de l’activité précède son début.');
  }
}

/** Statuts d'une tâche terminée (rapport, alertes). */
export const TACHE_FINIE: TaskStatus[] = [TaskStatus.TERMINEE, TaskStatus.VALIDEE];
