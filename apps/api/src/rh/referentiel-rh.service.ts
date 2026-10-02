import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { estDrh } from '../socle/roles-fonctionnels';
import { BesoinFormationDto, FichePosteDto, StatutBesoinDto } from './dto/rh.dto';

const CHEFS: SystemRole[] = [SystemRole.CHEF_DIVISION, SystemRole.CHEF_SECTION, SystemRole.CHEF_CELLULE];

/**
 * Fiches de poste et plan de formation (socle N6, SIG-RF-CAR-07 et 08).
 * - Fiche de poste rattachée à la fonction, jamais à la personne : rédigée par le DRH, lue par tout
 *   agent (sa fonction comme celles de son équipe).
 * - Besoins de formation exprimés par les chefs d'unité (et la Direction) pour leur unité, avec
 *   priorité et origine ; le DRH les consolide dans le plan annuel (retenu, réalisé, écarté).
 */
@Injectable()
export class ReferentielRhService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ fiches de poste

  async fiches(actor: AuthenticatedUser) {
    const fiches = await this.prisma.fichePoste.findMany({ orderBy: { fonction: 'asc' }, select: { id: true, fonction: true, missions: true, activites: true, competences: true, updatedAt: true } });
    const moi = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { jobTitle: true, agent: { select: { fonction: true } } } });
    const maFonction = (moi?.agent?.fonction || moi?.jobTitle || '').trim().toLowerCase();
    return { fiches, maFicheId: fiches.find((f) => f.fonction.trim().toLowerCase() === maFonction)?.id ?? null, droits: { gerer: estDrh(actor) } };
  }

  async enregistrerFiche(actor: AuthenticatedUser, dto: FichePosteDto, id?: string) {
    if (!estDrh(actor)) throw new ForbiddenException('Les fiches de poste sont rédigées par le DRH.');
    const data = { fonction: dto.fonction.trim(), missions: dto.missions.trim(), activites: dto.activites?.trim() || null, competences: dto.competences?.trim() || null, majParId: actor.id };
    try {
      const f = id
        ? await this.prisma.fichePoste.update({ where: { id }, data }).catch((e) => {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw new NotFoundException('Fiche de poste introuvable.');
            throw e;
          })
        : await this.prisma.fichePoste.create({ data });
      await this.audit.log({ actorId: actor.id, action: id ? AuditAction.MODIFICATION : AuditAction.CREATION, entityType: 'FichePoste', entityId: f.id, metadata: { fonction: f.fonction } });
      return f;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Une fiche existe déjà pour cette fonction.');
      throw e;
    }
  }

  // ------------------------------------------------------------------ besoins de formation

  /** Unité organisationnelle du chef (section, cellule ou division ; la Direction pour DN et DNA). */
  private async uniteDe(actor: AuthenticatedUser) {
    const where: Prisma.UniteOrganisationnelleWhereInput | null = actor.sectionId
      ? { sectionId: actor.sectionId }
      : actor.celluleId
        ? { celluleId: actor.celluleId }
        : actor.divisionId
          ? { divisionId: actor.divisionId }
          : actor.role === SystemRole.DN || actor.role === SystemRole.DNA
            ? { parentId: null, dateFermeture: null }
            : null;
    return where ? this.prisma.uniteOrganisationnelle.findFirst({ where, select: { id: true, libelle: true } }) : null;
  }

  private exprime(actor: AuthenticatedUser) {
    return CHEFS.includes(actor.role) || actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
  }

  async besoins(actor: AuthenticatedUser, annee: number) {
    const drh = estDrh(actor);
    const direction = actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
    if (!drh && !this.exprime(actor)) throw new ForbiddenException('Les besoins de formation sont exprimés par les chefs d’unité et consolidés par le DRH.');
    let where: Prisma.BesoinFormationWhereInput = { annee };
    const unite = await this.uniteDe(actor);
    if (!drh && !direction) {
      // Chef : son unité et les unités qui en dépendent (un chef de division voit ses sections).
      const ids = unite ? [unite.id, ...(await this.prisma.uniteOrganisationnelle.findMany({ where: { parentId: unite.id }, select: { id: true } })).map((u) => u.id)] : [];
      where = { annee, uniteId: { in: ids } };
    }
    const lignes = await this.prisma.besoinFormation.findMany({ where, orderBy: [{ priorite: 'asc' }, { createdAt: 'desc' }] });
    const unites = new Map((await this.prisma.uniteOrganisationnelle.findMany({ where: { id: { in: [...new Set(lignes.map((l) => l.uniteId))] } }, select: { id: true, libelle: true } })).map((u) => [u.id, u.libelle]));
    const ordre: Record<string, number> = { HAUTE: 0, MOYENNE: 1, BASSE: 2 };
    return {
      annee,
      besoins: lignes.map((l) => ({ ...l, unite: unites.get(l.uniteId) ?? null })).sort((a, b) => (ordre[a.priorite] ?? 3) - (ordre[b.priorite] ?? 3)),
      monUnite: unite?.libelle ?? null,
      droits: { exprimer: this.exprime(actor) && !!unite, decider: drh },
    };
  }

  async exprimer(actor: AuthenticatedUser, dto: BesoinFormationDto) {
    if (!this.exprime(actor)) throw new ForbiddenException('Les besoins de formation sont exprimés par les chefs d’unité.');
    const unite = await this.uniteDe(actor);
    if (!unite) throw new ConflictException('Votre unité n’est pas retrouvée dans l’organigramme.');
    const b = await this.prisma.besoinFormation.create({
      data: { annee: dto.annee, uniteId: unite.id, intitule: dto.intitule.trim(), priorite: dto.priorite, origine: dto.origine, effectif: dto.effectif ?? 1, creeParId: actor.id },
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'BesoinFormation', entityId: b.id, metadata: { intitule: b.intitule, unite: unite.libelle } });
    return b;
  }

  async changerStatut(actor: AuthenticatedUser, id: string, dto: StatutBesoinDto) {
    if (!estDrh(actor)) throw new ForbiddenException('Le plan de formation est arrêté par le DRH.');
    const b = await this.prisma.besoinFormation.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Besoin introuvable.');
    if (b.statut === dto.statut) throw new ConflictException('Le besoin a déjà ce statut.');
    const maj = await this.prisma.besoinFormation.update({ where: { id }, data: { statut: dto.statut } });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'BesoinFormation', entityId: id, metadata: { de: b.statut, vers: dto.statut } });
    return maj;
  }
}
