import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, RegistrePortee, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { NumerotationService, TRANSACTION_NUMEROTATION } from './numerotation.service';
import { UNITE_DIRECTION, assertUnitePourPortee } from './unites';
import { CreateHabilitationDto, CreateRegistreDto, InitialiserCompteurDto, UpdateRegistreDto } from './dto/registre.dto';

/**
 * Paramétrage du courrier par l'administrateur système (comme les types de
 * congés) : registres, habilitations courrier, reprise des compteurs. Aucun
 * accès au contenu des courriers — seulement à la configuration et à des
 * comptages.
 */
@Injectable()
export class RegistresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numerotation: NumerotationService,
  ) {}

  findAll() {
    return this.prisma.registreCourrier.findMany({ orderBy: [{ nature: 'asc' }, { code: 'asc' }] });
  }

  async findOneOrThrow(id: string) {
    const registre = await this.prisma.registreCourrier.findUnique({ where: { id } });
    if (!registre) throw new NotFoundException('Registre introuvable');
    return registre;
  }

  /** Unités proposables (DNPEC, Divisions, Cellules) — configuration, sans contenu. */
  async unites() {
    const [divisions, cellules] = await Promise.all([
      this.prisma.division.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
      this.prisma.cellule.findMany({ select: { id: true, code: true, name: true, chefId: true }, orderBy: { code: 'asc' } }),
    ]);
    return [
      { key: UNITE_DIRECTION, code: 'DNPEC', libelle: 'Direction (DNPEC)' },
      ...divisions.map((d) => ({ key: `DIV:${d.id}`, code: d.code, libelle: d.name })),
      ...cellules.map((c) => ({ key: `CEL:${c.id}`, code: c.code, libelle: c.name })),
    ];
  }

  async create(actor: AuthenticatedUser, dto: CreateRegistreDto) {
    this.numerotation.validerGabarit(dto.gabaritNumero);
    const existing = await this.prisma.registreCourrier.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Ce code de registre existe déjà.');
    const created = await this.prisma.registreCourrier.create({ data: dto });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'RegistreCourrier',
      entityId: created.id,
      metadata: { ...dto },
    });
    return created;
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateRegistreDto) {
    const before = await this.findOneOrThrow(id);
    if (dto.gabaritNumero) this.numerotation.validerGabarit(dto.gabaritNumero);
    const changeStructure =
      (dto.nature && dto.nature !== before.nature) || (dto.portee && dto.portee !== before.portee);
    if (changeStructure && (await this.aDesEntrees(id))) {
      throw new ConflictException('Nature et portée sont figées dès qu’une entrée existe dans ce registre.');
    }
    const updated = await this.prisma.registreCourrier.update({ where: { id }, data: dto });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'RegistreCourrier',
      entityId: id,
      metadata: {
        avant: { libelle: before.libelle, gabaritNumero: before.gabaritNumero, isActive: before.isActive, nature: before.nature, portee: before.portee },
        apres: { libelle: updated.libelle, gabaritNumero: updated.gabaritNumero, isActive: updated.isActive, nature: updated.nature, portee: updated.portee },
      },
    });
    return updated;
  }

  // ------------------------------------------------------------------
  // Habilitations courrier (secrétariat) — aucune autorité d'imputation.
  // ------------------------------------------------------------------

  findHabilitations() {
    return this.prisma.habilitationCourrier.findMany({
      include: { registre: { select: { code: true, libelle: true, nature: true, portee: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findMesHabilitations(actor: AuthenticatedUser) {
    return this.prisma.habilitationCourrier.findMany({
      where: { userId: actor.id, revoqueeAt: null, registre: { isActive: true } },
      include: { registre: true },
    });
  }

  async createHabilitation(actor: AuthenticatedUser, dto: CreateHabilitationDto) {
    const registre = await this.findOneOrThrow(dto.registreId);
    const uniteKey = registre.portee === RegistrePortee.DIRECTION ? UNITE_DIRECTION : dto.uniteKey ?? '';
    assertUnitePourPortee(registre.portee, uniteKey);
    await this.numerotation.codeUnite(uniteKey); // 404 si l'unité n'existe pas
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { status: true } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.status !== UserStatus.ACTIF) throw new ForbiddenException('Seul un compte actif peut être habilité.');
    const active = await this.prisma.habilitationCourrier.findFirst({
      where: { userId: dto.userId, registreId: registre.id, uniteKey, revoqueeAt: null },
    });
    if (active) throw new ConflictException('Cette personne est déjà habilitée sur ce registre pour cette unité.');

    const created = await this.prisma.habilitationCourrier.create({
      data: { userId: dto.userId, registreId: registre.id, uniteKey, accordeeParId: actor.id },
    });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'HabilitationCourrier',
      entityId: created.id,
      metadata: { userId: dto.userId, registre: registre.code, uniteKey },
    });
    return created;
  }

  async revoquerHabilitation(actor: AuthenticatedUser, id: string) {
    const h = await this.prisma.habilitationCourrier.findUnique({ where: { id } });
    if (!h) throw new NotFoundException('Habilitation introuvable');
    if (h.revoqueeAt) throw new ConflictException('Cette habilitation est déjà révoquée.');
    const updated = await this.prisma.habilitationCourrier.update({
      where: { id },
      data: { revoqueeAt: new Date(), revoqueeParId: actor.id },
    });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'HabilitationCourrier',
      entityId: id,
      metadata: { event: 'revocation' },
    });
    return updated;
  }

  // ------------------------------------------------------------------
  // Compteurs — lecture et reprise des numéros déjà consommés sur papier.
  // ------------------------------------------------------------------

  async compteurs(registreId: string) {
    await this.findOneOrThrow(registreId);
    return this.prisma.compteurRegistre.findMany({
      where: { registreId },
      orderBy: [{ annee: 'desc' }, { uniteKey: 'asc' }],
    });
  }

  /**
   * Reprise : fixe le dernier numéro consommé (le prochain sera dernier + 1),
   * UNIQUEMENT tant qu'aucune entrée n'a été numérotée par le système pour ce
   * (registre, unité, année). Dans une transaction qui verrouille d'abord la
   * ligne du compteur (upsert neutre) : un enregistrement concurrent attend
   * la fin de la reprise, ou la reprise constate l'entrée et refuse.
   */
  async initialiserCompteur(actor: AuthenticatedUser, registreId: string, dto: InitialiserCompteurDto) {
    const registre = await this.findOneOrThrow(registreId);
    const uniteKey = registre.portee === RegistrePortee.DIRECTION ? UNITE_DIRECTION : dto.uniteKey ?? '';
    assertUnitePourPortee(registre.portee, uniteKey);
    await this.numerotation.codeUnite(uniteKey);

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.$queryRaw<{ dernier: number }[]>`
        INSERT INTO "compteurs_registre" ("registreId", "uniteKey", "annee", "dernier", "updatedAt")
        VALUES (${registre.id}, ${uniteKey}, ${dto.annee}, 0, now())
        ON CONFLICT ("registreId", "uniteKey", "annee")
        DO UPDATE SET "dernier" = "compteurs_registre"."dernier"
        RETURNING "dernier"`;
      const where = { registreId: registre.id, uniteKey, annee: dto.annee };
      const numerotees =
        (await tx.courrierArrivee.count({ where })) +
        (await tx.acteCourrier.count({ where: { ...where, sequence: { not: null } } }));
      if (numerotees > 0) {
        throw new ConflictException(
          'Des entrées ont déjà été numérotées par le système pour ce registre, cette unité et cette année : reprise impossible.',
        );
      }
      const compteur = await tx.compteurRegistre.update({
        where: { registreId_uniteKey_annee: where },
        data: { dernier: dto.dernier, updatedAt: new Date() },
      });
      await this.audit.log(
        {
          actorId: actor.id,
          action: AuditAction.MODIFICATION,
          entityType: 'CompteurRegistre',
          entityId: `${registre.id}|${uniteKey}|${dto.annee}`,
          metadata: { event: 'reprise_compteur', registre: registre.code, uniteKey, annee: dto.annee, avant: Number(before[0]?.dernier ?? 0), apres: dto.dernier },
        },
        tx,
      );
      return compteur;
    }, TRANSACTION_NUMEROTATION);
  }

  private async aDesEntrees(registreId: string): Promise<boolean> {
    const [a, b] = await Promise.all([
      this.prisma.courrierArrivee.count({ where: { registreId } }),
      this.prisma.acteCourrier.count({ where: { registreId } }),
    ]);
    return a + b > 0;
  }
}
