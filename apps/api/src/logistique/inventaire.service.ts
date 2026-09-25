import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import ExcelJS from 'exceljs';
import { AuditAction, EtatBien, NatureCategorieLogistique, NotificationType, Prisma, SystemRole, TypeMouvementBien, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { TRANSACTION_NUMEROTATION } from '../courrier/numerotation.service';
import { GestionnairesLogistiqueService } from './gestionnaires.service';
import { ReferentielLogistiqueService } from './referentiel.service';
import { AffecterBienDto, CreerBienDto, EtatBienDto, FiltresBiensDto, ModifierBienDto, MotifDto } from './dto/logistique.dto';

const NOM = { select: { id: true, firstName: true, lastName: true } } as const;
const LIB = { select: { id: true, code: true, name: true } } as const;

const AFFECTATION_SELECT = {
  id: true,
  debut: true,
  fin: true,
  userId: true,
  user: { select: { id: true, firstName: true, lastName: true, status: true } },
  divisionId: true,
  division: LIB,
  sectionId: true,
  section: LIB,
  celluleId: true,
  cellule: LIB,
  faitePar: NOM,
} satisfies Prisma.AffectationBienSelect;

const BIEN_SELECT = {
  id: true,
  numeroInventaire: true,
  categorie: { select: { id: true, code: true, libelle: true } },
  designation: true,
  marque: true,
  numeroSerie: true,
  emplacement: true,
  dateAcquisition: true,
  etat: true,
  createdAt: true,
  affectations: { where: { fin: null }, select: AFFECTATION_SELECT },
} satisfies Prisma.BienSelect;

type BienBrut = Prisma.BienGetPayload<{ select: typeof BIEN_SELECT }>;
type Affectation = Prisma.AffectationBienGetPayload<{ select: typeof AFFECTATION_SELECT }>;

export function libelleAffectation(a: Affectation): string {
  if (a.user) return `${a.user.firstName} ${a.user.lastName}`;
  if (a.section && a.division) return `${a.division.name} / ${a.section.name}`;
  return a.division?.name ?? a.cellule?.name ?? '—';
}

const ETAT_LIBELLE: Record<EtatBien, string> = {
  EN_SERVICE: 'En service',
  EN_PANNE: 'En panne',
  EN_REPARATION: 'En réparation',
  REFORME: 'Réformé',
};

/**
 * Inventaire des biens (décision D9-4 : aucun montant) :
 * - numéro attribué par le système, séquentiel par catégorie et par année,
 *   dans la transaction de création (même compteur transactionnel que le
 *   registre du courrier : ni trou ni doublon) ; figé et jamais supprimé
 *   (trigger) — un bien sorti du parc est RÉFORMÉ ;
 * - historique en ajout seul (trigger) : acquisition, affectations, retours,
 *   changements d'état, modifications, interventions ;
 * - besoin d'en connaître : inventaire complet pour les gestionnaires et
 *   DN/DNA ; ailleurs, les biens affectés à soi, à son unité et, pour un
 *   chef, à son périmètre et à ses agents.
 */
@Injectable()
export class InventaireService {
  private readonly logger = new Logger(InventaireService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cascade: CascadeService,
    private readonly notifications: NotificationsService,
    private readonly gestionnaires: GestionnairesLogistiqueService,
    private readonly referentiel: ReferentielLogistiqueService,
  ) {}

  // ------------------------------------------------------------ Visibilité

  /** null = inventaire complet ; sinon filtre sur l'affectation en cours. */
  private perimetreAffectation(actor: AuthenticatedUser): Prisma.AffectationBienWhereInput[] | null {
    const v = this.cascade.getVisibilityView(actor);
    if (v.role === SystemRole.DN || v.role === SystemRole.DNA) return null;
    const ors: Prisma.AffectationBienWhereInput[] = [{ userId: actor.id }];
    if (actor.interimForId) ors.push({ userId: actor.interimForId });
    switch (v.role) {
      case SystemRole.CHEF_DIVISION:
        if (v.divisionId) ors.push({ divisionId: v.divisionId }, { user: { divisionId: v.divisionId } });
        break;
      case SystemRole.CHEF_SECTION:
        if (v.sectionId) ors.push({ sectionId: v.sectionId }, { user: { sectionId: v.sectionId } });
        break;
      case SystemRole.CHEF_CELLULE:
        if (v.celluleId) ors.push({ celluleId: v.celluleId }, { user: { celluleId: v.celluleId } });
        break;
      default:
        // Biens de sa propre unité (imprimante de la section...) : pour
        // pouvoir signaler une panne. Jamais ceux des collègues.
        if (v.sectionId) ors.push({ sectionId: v.sectionId });
        else if (v.divisionId) ors.push({ divisionId: v.divisionId, sectionId: null });
        if (v.celluleId) ors.push({ celluleId: v.celluleId });
    }
    return ors;
  }

  async whereVisible(actor: AuthenticatedUser): Promise<{ where: Prisma.BienWhereInput; gestionnaire: boolean }> {
    const gestionnaire = await this.gestionnaires.estGestionnaire(actor);
    const perimetre = gestionnaire ? null : this.perimetreAffectation(actor);
    return { where: perimetre ? { affectations: { some: { fin: null, OR: perimetre } } } : {}, gestionnaire };
  }

  private vue(b: BienBrut, gestionnaire: boolean) {
    const affectation = b.affectations[0] ?? null;
    const actif = b.etat !== EtatBien.REFORME;
    return {
      id: b.id,
      numeroInventaire: b.numeroInventaire,
      categorie: b.categorie,
      designation: b.designation,
      marque: b.marque,
      numeroSerie: b.numeroSerie,
      emplacement: b.emplacement,
      dateAcquisition: b.dateAcquisition,
      etat: b.etat,
      createdAt: b.createdAt,
      affectation: affectation ? { ...affectation, libelle: libelleAffectation(affectation) } : null,
      droits: {
        modifier: gestionnaire && actif,
        affecter: gestionnaire && actif,
        retour: gestionnaire && actif && !!affectation,
        changerEtat: gestionnaire && actif,
        signalerPanne: actif,
      },
    };
  }

  async lister(actor: AuthenticatedUser, f: FiltresBiensDto) {
    const { where, gestionnaire } = await this.whereVisible(actor);
    const q = f.q?.trim();
    const biens = await this.prisma.bien.findMany({
      where: {
        AND: [
          where,
          f.categorieId ? { categorieId: f.categorieId } : {},
          f.etat ? { etat: f.etat } : {},
          q
            ? {
                OR: [
                  { numeroInventaire: { contains: q, mode: 'insensitive' } },
                  { designation: { contains: q, mode: 'insensitive' } },
                  { numeroSerie: { contains: q, mode: 'insensitive' } },
                  { marque: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {},
        ],
      },
      select: BIEN_SELECT,
      orderBy: [{ categorie: { code: 'asc' } }, { annee: 'desc' }, { sequence: 'desc' }],
    });
    return biens.map((b) => this.vue(b, gestionnaire));
  }

  async fiche(actor: AuthenticatedUser, id: string) {
    const { where, gestionnaire } = await this.whereVisible(actor);
    const b = await this.prisma.bien.findFirst({ where: { AND: [{ id }, where] }, select: BIEN_SELECT });
    if (!b) {
      const existe = await this.prisma.bien.count({ where: { id } });
      if (existe) throw new ForbiddenException('Ce bien est hors de votre périmètre.');
      throw new NotFoundException('Bien introuvable');
    }
    const historique = await this.prisma.mouvementBien.findMany({
      where: { bienId: id },
      select: { id: true, type: true, detail: true, createdAt: true, par: NOM },
      orderBy: { createdAt: 'desc' },
    });
    const affectations = gestionnaire
      ? await this.prisma.affectationBien.findMany({ where: { bienId: id }, select: AFFECTATION_SELECT, orderBy: { debut: 'desc' } })
      : [];
    return {
      ...this.vue(b, gestionnaire),
      historique,
      affectations: affectations.map((a) => ({ ...a, libelle: libelleAffectation(a) })),
    };
  }

  /** Bien visible de l'acteur (demande d'intervention) — 403/404 sinon. */
  async assertVisible(actor: AuthenticatedUser, id: string) {
    const { where } = await this.whereVisible(actor);
    const b = await this.prisma.bien.findFirst({ where: { AND: [{ id }, where] }, select: { id: true, etat: true, categorieId: true, numeroInventaire: true, designation: true } });
    if (!b) {
      const existe = await this.prisma.bien.count({ where: { id } });
      if (existe) throw new ForbiddenException('Ce bien est hors de votre périmètre.');
      throw new NotFoundException('Bien introuvable');
    }
    return b;
  }

  // ------------------------------------------------------------ Écritures (gestionnaires)

  async creer(actor: AuthenticatedUser, dto: CreerBienDto) {
    await this.gestionnaires.assertGestionnaire(actor);
    const categorie = await this.referentiel.categorieActive(dto.categorieId, NatureCategorieLogistique.BIEN);
    const annee = new Date().getFullYear();
    const bien = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ dernier: number }[]>`
        INSERT INTO "compteurs_inventaire" ("categorieId", "annee", "dernier", "updatedAt")
        VALUES (${categorie.id}, ${annee}, 1, now())
        ON CONFLICT ("categorieId", "annee")
        DO UPDATE SET "dernier" = "compteurs_inventaire"."dernier" + 1, "updatedAt" = now()
        RETURNING "dernier"`;
      const sequence = Number(rows[0]!.dernier);
      const numeroInventaire = `${categorie.code}-${annee}-${String(sequence).padStart(4, '0')}`;
      const b = await tx.bien.create({
        data: {
          numeroInventaire,
          categorieId: categorie.id,
          annee,
          sequence,
          designation: dto.designation,
          marque: dto.marque ?? null,
          numeroSerie: dto.numeroSerie ?? null,
          emplacement: dto.emplacement ?? null,
          dateAcquisition: dto.dateAcquisition ? new Date(dto.dateAcquisition) : null,
          creeParId: actor.id,
        },
        select: { id: true, numeroInventaire: true },
      });
      await tx.mouvementBien.create({
        data: { bienId: b.id, type: TypeMouvementBien.ACQUISITION, detail: { designation: dto.designation, categorie: categorie.code }, parId: actor.id },
      });
      return b;
    }, TRANSACTION_NUMEROTATION);
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'Bien', entityId: bien.id, metadata: { numeroInventaire: bien.numeroInventaire } });
    return this.fiche(actor, bien.id);
  }

  private async bienModifiable(id: string) {
    const b = await this.prisma.bien.findUnique({ where: { id }, select: { id: true, etat: true, numeroInventaire: true, designation: true, marque: true, numeroSerie: true, emplacement: true, dateAcquisition: true } });
    if (!b) throw new NotFoundException('Bien introuvable');
    if (b.etat === EtatBien.REFORME) throw new ConflictException(`Le bien ${b.numeroInventaire} est réformé : il n’est plus modifiable.`);
    return b;
  }

  async modifier(actor: AuthenticatedUser, id: string, dto: ModifierBienDto) {
    await this.gestionnaires.assertGestionnaire(actor);
    const avant = await this.bienModifiable(id);
    const data = { ...dto, dateAcquisition: dto.dateAcquisition === undefined ? undefined : dto.dateAcquisition ? new Date(dto.dateAcquisition) : null };
    const champs = Object.keys(dto) as (keyof ModifierBienDto)[];
    if (champs.length === 0) throw new BadRequestException('Aucune modification.');
    await this.prisma.$transaction([
      this.prisma.bien.update({ where: { id }, data }),
      this.prisma.mouvementBien.create({
        data: {
          bienId: id,
          type: TypeMouvementBien.MODIFICATION,
          detail: { avant: Object.fromEntries(champs.map((c) => [c, avant[c] ?? null])), apres: { ...dto } } as Prisma.InputJsonValue,
          parId: actor.id,
        },
      }),
    ]);
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Bien', entityId: id, metadata: { champs } });
    return this.fiche(actor, id);
  }

  async affecter(actor: AuthenticatedUser, id: string, dto: AffecterBienDto) {
    await this.gestionnaires.assertGestionnaire(actor);
    const bien = await this.bienModifiable(id);
    const cible = await this.cibleAffectation(dto);
    await this.prisma.$transaction(async (tx) => {
      const ouverte = await tx.affectationBien.findFirst({ where: { bienId: id, fin: null }, select: AFFECTATION_SELECT });
      if (ouverte) {
        await tx.affectationBien.update({ where: { id: ouverte.id }, data: { fin: new Date() } });
        await tx.mouvementBien.create({
          data: { bienId: id, type: TypeMouvementBien.RETOUR, detail: { de: libelleAffectation(ouverte), motif: 'Réaffectation' }, parId: actor.id },
        });
      }
      await tx.affectationBien.create({ data: { bienId: id, ...cible.data, faiteParId: actor.id } });
      await tx.mouvementBien.create({ data: { bienId: id, type: TypeMouvementBien.AFFECTATION, detail: { a: cible.libelle }, parId: actor.id } });
    });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Bien',
      entityId: id,
      metadata: { event: 'affectation', numeroInventaire: bien.numeroInventaire, ...cible.data },
    });
    return this.fiche(actor, id);
  }

  /** Personne active OU unité active (§2.3) — jamais les deux. */
  private async cibleAffectation(dto: AffecterBienDto) {
    const unite = dto.divisionId || dto.sectionId || dto.celluleId;
    if (!!dto.userId === !!unite) throw new BadRequestException('Affectez le bien à une personne OU à une unité.');
    if (dto.userId) {
      const u = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { status: true, firstName: true, lastName: true } });
      if (!u) throw new NotFoundException('Utilisateur introuvable');
      if (u.status !== UserStatus.ACTIF) throw new ConflictException('Un bien ne peut être affecté qu’à un compte actif.');
      return { data: { userId: dto.userId }, libelle: `${u.firstName} ${u.lastName}` };
    }
    if (dto.celluleId) {
      if (dto.divisionId || dto.sectionId) throw new BadRequestException('Une cellule ne se combine pas avec une division.');
      const c = await this.prisma.cellule.findUnique({ where: { id: dto.celluleId } });
      if (!c) throw new NotFoundException('Cellule introuvable');
      if (!c.isActive) throw new ConflictException('Cette cellule est suspendue.');
      return { data: { celluleId: c.id }, libelle: c.name };
    }
    if (!dto.divisionId) throw new BadRequestException('Une section s’indique avec sa division.');
    const d = await this.prisma.division.findUnique({ where: { id: dto.divisionId } });
    if (!d) throw new NotFoundException('Division introuvable');
    if (!d.isActive) throw new ConflictException('Cette division est suspendue.');
    if (!dto.sectionId) return { data: { divisionId: d.id }, libelle: d.name };
    const s = await this.prisma.section.findUnique({ where: { id: dto.sectionId } });
    if (!s || s.divisionId !== d.id) throw new NotFoundException('Section introuvable dans cette division');
    if (!s.isActive) throw new ConflictException('Cette section est suspendue.');
    return { data: { divisionId: d.id, sectionId: s.id }, libelle: `${d.name} / ${s.name}` };
  }

  async retour(actor: AuthenticatedUser, id: string, dto: MotifDto) {
    await this.gestionnaires.assertGestionnaire(actor);
    await this.bienModifiable(id);
    const ouverte = await this.prisma.affectationBien.findFirst({ where: { bienId: id, fin: null }, select: AFFECTATION_SELECT });
    if (!ouverte) throw new ConflictException('Ce bien n’est affecté à personne.');
    await this.prisma.$transaction([
      this.prisma.affectationBien.update({ where: { id: ouverte.id }, data: { fin: new Date() } }),
      this.prisma.mouvementBien.create({
        data: { bienId: id, type: TypeMouvementBien.RETOUR, detail: { de: libelleAffectation(ouverte), motif: dto.motif ?? null }, parId: actor.id },
      }),
    ]);
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'Bien', entityId: id, metadata: { event: 'retour', motif: dto.motif } });
    return this.fiche(actor, id);
  }

  /** Changement d'état ; la réforme est définitive et clôt l'affectation en cours. */
  async changerEtat(actor: AuthenticatedUser, id: string, dto: EtatBienDto) {
    await this.gestionnaires.assertGestionnaire(actor);
    const bien = await this.bienModifiable(id);
    if (bien.etat === dto.etat) throw new ConflictException(`Le bien est déjà « ${ETAT_LIBELLE[dto.etat]} ».`);
    if (dto.etat === EtatBien.REFORME && !dto.motif) throw new BadRequestException('La réforme d’un bien exige un motif.');
    await this.prisma.$transaction(async (tx) => {
      if (dto.etat === EtatBien.REFORME) {
        const ouverte = await tx.affectationBien.findFirst({ where: { bienId: id, fin: null }, select: AFFECTATION_SELECT });
        if (ouverte) {
          await tx.affectationBien.update({ where: { id: ouverte.id }, data: { fin: new Date() } });
          await tx.mouvementBien.create({
            data: { bienId: id, type: TypeMouvementBien.RETOUR, detail: { de: libelleAffectation(ouverte), motif: 'Réforme' }, parId: actor.id },
          });
        }
      }
      await tx.bien.update({ where: { id }, data: { etat: dto.etat } });
      await tx.mouvementBien.create({
        data: { bienId: id, type: TypeMouvementBien.CHANGEMENT_ETAT, detail: { de: bien.etat, a: dto.etat, motif: dto.motif ?? null }, parId: actor.id },
      });
    });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Bien',
      entityId: id,
      metadata: { event: 'changement_etat', de: bien.etat, a: dto.etat, motif: dto.motif },
    });
    return this.fiche(actor, id);
  }

  // ------------------------------------------------------------ Export

  async exporter(actor: AuthenticatedUser, f: FiltresBiensDto): Promise<Buffer> {
    const lignes = await this.lister(actor, f);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SI DNPEC';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Inventaire');
    sheet.columns = [
      { header: 'N° d’inventaire', key: 'numero', width: 18 },
      { header: 'Catégorie', key: 'categorie', width: 22 },
      { header: 'Désignation', key: 'designation', width: 36 },
      { header: 'Marque', key: 'marque', width: 16 },
      { header: 'N° de série', key: 'serie', width: 20 },
      { header: 'Emplacement', key: 'emplacement', width: 22 },
      { header: 'État', key: 'etat', width: 14 },
      { header: 'Affecté à', key: 'affectation', width: 30 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } };
    for (const b of lignes) {
      sheet.addRow({
        numero: b.numeroInventaire,
        categorie: b.categorie.libelle,
        designation: b.designation,
        marque: b.marque ?? '',
        serie: b.numeroSerie ?? '',
        emplacement: b.emplacement ?? '',
        etat: ETAT_LIBELLE[b.etat],
        affectation: b.affectation?.libelle ?? '',
      });
    }
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.PUBLICATION,
      entityType: 'Inventaire',
      entityId: 'inventaire',
      metadata: { event: 'export_excel', filtres: { ...f }, lignes: lignes.length },
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  // ------------------------------------------------------------ Job : départs

  @Cron('20 0 * * *')
  async cron(): Promise<void> {
    try {
      await this.alertesDepart();
    } catch (e) {
      this.logger.error(`Alertes « bien à récupérer » : ${(e as Error).message}`);
    }
  }

  /**
   * Détenteur parti (compte suspendu ou supprimé) : il garde le bien en
   * affectation — rien n'est déplacé automatiquement — et les gestionnaires
   * sont alertés une fois pour organiser le retour.
   */
  async alertesDepart(): Promise<number> {
    const affectations = await this.prisma.affectationBien.findMany({
      where: { fin: null, alerteDepartAt: null, user: { status: { not: UserStatus.ACTIF } } },
      select: { id: true, bien: { select: { id: true, numeroInventaire: true, designation: true } }, user: NOM },
    });
    if (affectations.length === 0) return 0;
    const destinataires = await this.gestionnaires.idsGestionnaires();
    let n = 0;
    for (const a of affectations) {
      const pose = await this.prisma.affectationBien.updateMany({ where: { id: a.id, alerteDepartAt: null }, data: { alerteDepartAt: new Date() } });
      if (pose.count === 0) continue;
      n++;
      for (const uid of destinataires) {
        await this.notifications.notify(
          uid,
          NotificationType.BIEN_A_RECUPERER,
          'Bien à récupérer',
          `${a.bien.numeroInventaire} (${a.bien.designation}) reste affecté à ${a.user!.firstName} ${a.user!.lastName}, dont le compte n’est plus actif.`,
          `/logistique?onglet=inventaire&id=${a.bien.id}`,
          a.bien.numeroInventaire,
        );
      }
    }
    return n;
  }
}
