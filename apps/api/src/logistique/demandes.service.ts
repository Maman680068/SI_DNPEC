import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  AuditAction,
  EtatBien,
  NatureCategorieLogistique,
  NotificationType,
  Prisma,
  StatutDemandeLogistique as S,
  TypeDemandeLogistique,
  TypeMouvementBien,
  TypeMouvementStock,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { GestionnairesLogistiqueService } from './gestionnaires.service';
import { ReferentielLogistiqueService } from './referentiel.service';
import { InventaireService } from './inventaire.service';
import { CreerDemandeDto, FiltresDemandesDto, MotifObligatoireDto, TraiterDemandeDto } from './dto/logistique.dto';

const NOM = { select: { id: true, firstName: true, lastName: true } } as const;

const DEMANDE_SELECT = {
  id: true,
  type: true,
  objet: true,
  justification: true,
  quantite: true,
  quantiteLivree: true,
  statut: true,
  validationChef: true,
  compteRendu: true,
  motifRefus: true,
  createdAt: true,
  valideeAt: true,
  priseEnChargeAt: true,
  traiteeAt: true,
  refuseeAt: true,
  demandeurId: true,
  demandeur: { select: { id: true, firstName: true, lastName: true, role: true, divisionId: true, sectionId: true, celluleId: true } },
  categorie: { select: { id: true, code: true, libelle: true } },
  article: { select: { id: true, libelle: true, unite: true, suiviStock: true, stock: true } },
  bien: { select: { id: true, numeroInventaire: true, designation: true } },
  valideePar: NOM,
  traiteePar: NOM,
  refuseePar: NOM,
} satisfies Prisma.DemandeLogistiqueSelect;

type DemandeBrute = Prisma.DemandeLogistiqueGetPayload<{ select: typeof DEMANDE_SELECT }>;

export const TYPE_DEMANDE_LIBELLE: Record<TypeDemandeLogistique, string> = {
  FOURNITURE: 'Fournitures',
  MATERIEL: 'Matériel',
  INTERVENTION: 'Intervention',
};

const STATUT_LIBELLE: Record<S, string> = {
  A_VALIDER: 'À valider par le chef',
  A_TRAITER: 'À traiter',
  EN_TRAITEMENT: 'En traitement',
  TRAITEE: 'Traitée',
  REFUSEE: 'Refusée',
  ANNULEE: 'Annulée',
};

/**
 * Demandes logistiques (décision D9-2). Circuit selon la catégorie, réglage
 * figé à la soumission :
 * - « validation du chef requise » : demandeur → chef direct → gestionnaire ;
 * - sinon : demandeur → gestionnaire.
 * Jamais d'auto-validation : ni le chef sur sa propre demande (cascade :
 * jamais sur soi-même ni sur le titulaire en intérim), ni le gestionnaire
 * sur la sienne. Visibilité : le demandeur, sa chaîne hiérarchique, DN/DNA,
 * et les gestionnaires dès que la demande leur est transmise.
 */
@Injectable()
export class DemandesLogistiqueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cascade: CascadeService,
    private readonly notifications: NotificationsService,
    private readonly gestionnaires: GestionnairesLogistiqueService,
    private readonly referentiel: ReferentielLogistiqueService,
    private readonly inventaire: InventaireService,
  ) {}

  // ------------------------------------------------------------ Lecture

  private whereVisible(actor: AuthenticatedUser, gestionnaire: boolean): Prisma.DemandeLogistiqueWhereInput {
    const cascade = this.cascade.getVisibleUserWhereForLeadershipScope(actor);
    if (Object.keys(cascade).length === 0) return {}; // DN/DNA : toutes les demandes
    return {
      OR: [
        { demandeurId: actor.id },
        ...(actor.interimForId ? [{ demandeurId: actor.interimForId }] : []),
        { demandeur: cascade },
        ...(gestionnaire ? [{ OR: [{ validationChef: false }, { valideeAt: { not: null } }] }] : []),
      ],
    };
  }

  private vue(actor: AuthenticatedUser, d: DemandeBrute, gestionnaire: boolean) {
    const chef = d.statut === S.A_VALIDER && this.cascade.hasDirectAuthorityOver(actor, d.demandeur);
    const soiMeme = this.cascade.isActingFor(actor, d.demandeurId);
    const gere = gestionnaire && !soiMeme;
    const { demandeur, article, ...reste } = d;
    return {
      ...reste,
      statutLibelle: STATUT_LIBELLE[d.statut],
      demandeur: { id: demandeur.id, firstName: demandeur.firstName, lastName: demandeur.lastName },
      article: article
        ? { id: article.id, libelle: article.libelle, unite: article.unite, suiviStock: article.suiviStock, stock: gestionnaire && article.suiviStock ? article.stock : null }
        : null,
      droits: {
        valider: chef,
        refuser: chef || (gere && (d.statut === S.A_TRAITER || d.statut === S.EN_TRAITEMENT)),
        prendreEnCharge: gere && d.statut === S.A_TRAITER,
        traiter: gere && d.statut === S.EN_TRAITEMENT,
        annuler: soiMeme && (d.statut === S.A_VALIDER || d.statut === S.A_TRAITER),
      },
    };
  }

  async lister(actor: AuthenticatedUser, f: FiltresDemandesDto) {
    const gestionnaire = await this.gestionnaires.estGestionnaire(actor);
    let vue: Prisma.DemandeLogistiqueWhereInput = {};
    if (f.vue === 'miennes') vue = { demandeurId: actor.id };
    if (f.vue === 'a_valider') vue = { statut: S.A_VALIDER, demandeurId: { not: actor.id } };
    if (f.vue === 'a_traiter') {
      if (!gestionnaire) return [];
      vue = { statut: { in: [S.A_TRAITER, S.EN_TRAITEMENT] } };
    }
    const demandes = await this.prisma.demandeLogistique.findMany({
      where: { AND: [this.whereVisible(actor, gestionnaire), vue, f.statut ? { statut: f.statut } : {}] },
      select: DEMANDE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    const vues = demandes.map((d) => this.vue(actor, d, gestionnaire));
    return f.vue === 'a_valider' ? vues.filter((d) => d.droits.valider) : vues;
  }

  async fiche(actor: AuthenticatedUser, id: string) {
    const gestionnaire = await this.gestionnaires.estGestionnaire(actor);
    const d = await this.prisma.demandeLogistique.findFirst({ where: { AND: [{ id }, this.whereVisible(actor, gestionnaire)] }, select: DEMANDE_SELECT });
    if (!d) {
      if (await this.prisma.demandeLogistique.count({ where: { id } })) throw new ForbiddenException('Cette demande est hors de votre périmètre.');
      throw new NotFoundException('Demande introuvable');
    }
    return this.vue(actor, d, gestionnaire);
  }

  /** Compteurs de la carte du tableau de bord. */
  async tableauDeBord(actor: AuthenticatedUser) {
    const gestionnaire = await this.gestionnaires.estGestionnaire(actor);
    const aValider = (await this.lister(actor, { vue: 'a_valider' })).length;
    const enCours = await this.prisma.demandeLogistique.count({
      where: { demandeurId: actor.id, statut: { in: [S.A_VALIDER, S.A_TRAITER, S.EN_TRAITEMENT] } },
    });
    const aTraiter = gestionnaire ? await this.prisma.demandeLogistique.count({ where: { statut: S.A_TRAITER } }) : 0;
    const sousSeuil = gestionnaire
      ? (await this.prisma.articleFourniture.findMany({ where: { suiviStock: true, actif: true, seuilAlerte: { not: null } }, select: { libelle: true, stock: true, seuilAlerte: true }, orderBy: { libelle: 'asc' } })).filter(
          (a) => a.stock < (a.seuilAlerte ?? 0),
        )
      : [];
    // Refonte de l'interface (étape 7) : libellés des premiers articles sous le seuil (bande de compteurs du gestionnaire).
    return { gestionnaire, aValider, aTraiter, stockBas: sousSeuil.length, stockBasLibelles: sousSeuil.slice(0, 3).map((a) => a.libelle), mesDemandesEnCours: enCours };
  }

  // ------------------------------------------------------------ Circuit

  async creer(actor: AuthenticatedUser, dto: CreerDemandeDto) {
    let categorieId: string;
    let validationChef: boolean;
    let quantite: number | null = null;
    let bien: { id: string; numeroInventaire: string } | null = null;

    if (dto.type === TypeDemandeLogistique.FOURNITURE) {
      if (!dto.articleId || dto.bienId || dto.categorieId) throw new BadRequestException('Une demande de fournitures indique un article (et seulement lui).');
      if (!dto.quantite) throw new BadRequestException('Indiquez la quantité demandée.');
      const article = await this.prisma.articleFourniture.findUnique({ where: { id: dto.articleId }, include: { categorie: true } });
      if (!article) throw new NotFoundException('Article introuvable');
      if (!article.actif || !article.categorie.actif) throw new ConflictException(`L’article « ${article.libelle} » n’est plus proposé.`);
      categorieId = article.categorieId;
      validationChef = article.categorie.validationChefRequise;
      quantite = dto.quantite;
    } else if (dto.type === TypeDemandeLogistique.MATERIEL) {
      if (!dto.categorieId || dto.bienId || dto.articleId) throw new BadRequestException('Une demande de matériel indique une catégorie de biens (et seulement elle).');
      const c = await this.referentiel.categorieActive(dto.categorieId, NatureCategorieLogistique.BIEN);
      categorieId = c.id;
      validationChef = c.validationChefRequise;
      quantite = dto.quantite ?? 1;
    } else {
      if (!dto.bienId || dto.articleId || dto.categorieId || dto.quantite) throw new BadRequestException('Une demande d’intervention indique le bien concerné (et seulement lui).');
      const b = await this.inventaire.assertVisible(actor, dto.bienId);
      if (b.etat === EtatBien.REFORME) throw new ConflictException(`Le bien ${b.numeroInventaire} est réformé.`);
      const c = await this.prisma.categorieLogistique.findUniqueOrThrow({ where: { id: b.categorieId } });
      categorieId = c.id;
      validationChef = c.validationChefRequise;
      bien = b;
    }

    const demande = await this.prisma.$transaction(async (tx) => {
      const d = await tx.demandeLogistique.create({
        data: {
          demandeurId: actor.id,
          type: dto.type,
          categorieId,
          articleId: dto.articleId ?? null,
          bienId: bien?.id ?? null,
          quantite,
          objet: dto.objet,
          justification: dto.justification ?? null,
          validationChef,
          statut: validationChef ? S.A_VALIDER : S.A_TRAITER,
        },
        select: { id: true, statut: true },
      });
      if (bien) {
        await tx.mouvementBien.create({
          data: { bienId: bien.id, type: TypeMouvementBien.INTERVENTION, detail: { event: 'demandee', demandeId: d.id, objet: dto.objet }, parId: actor.id },
        });
      }
      return d;
    });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'DemandeLogistique',
      entityId: demande.id,
      metadata: { type: dto.type, categorieId, articleId: dto.articleId, bienId: dto.bienId, quantite, validationChef },
    });

    const complet = await this.prisma.demandeLogistique.findUniqueOrThrow({ where: { id: demande.id }, select: DEMANDE_SELECT });
    if (validationChef) await this.notifierValideurs(complet);
    else await this.notifierGestionnaires(complet);
    return this.fiche(actor, demande.id);
  }

  /** Chef(s) direct(s) du demandeur ; à défaut, DN/DNA (même règle que les congés). */
  private async notifierValideurs(d: DemandeBrute) {
    const candidats = await this.prisma.user.findMany({
      where: { AND: [this.cascade.getUsersWithDirectAuthorityOverWhere(d.demandeur), { status: UserStatus.ACTIF }] },
      select: { id: true, role: true },
    });
    const proches = candidats.filter((c) => !this.cascade.isLeadershipRole(c.role));
    for (const v of proches.length > 0 ? proches : candidats) {
      await this.notifications.notify(
        v.id,
        NotificationType.LOGISTIQUE_DEMANDE_A_VALIDER,
        'Demande logistique à valider',
        `${d.demandeur.firstName} ${d.demandeur.lastName} — ${TYPE_DEMANDE_LIBELLE[d.type]} : ${d.objet}`,
        `/logistique?id=${d.id}`,
        `${d.demandeur.firstName} ${d.demandeur.lastName}`,
      );
    }
  }

  private async notifierGestionnaires(d: DemandeBrute) {
    for (const uid of await this.gestionnaires.idsGestionnaires()) {
      if (uid === d.demandeurId) continue;
      await this.notifications.notify(
        uid,
        NotificationType.LOGISTIQUE_DEMANDE_A_TRAITER,
        'Demande logistique à traiter',
        `${d.demandeur.firstName} ${d.demandeur.lastName} — ${TYPE_DEMANDE_LIBELLE[d.type]} : ${d.objet}`,
        `/logistique?id=${d.id}`,
        `${d.demandeur.firstName} ${d.demandeur.lastName}`,
      );
    }
  }

  private async charger(id: string): Promise<DemandeBrute> {
    const d = await this.prisma.demandeLogistique.findUnique({ where: { id }, select: DEMANDE_SELECT });
    if (!d) throw new NotFoundException('Demande introuvable');
    return d;
  }

  /** Transition atomique : 409 si la demande a changé d'état entre-temps. */
  private async transition(tx: Prisma.TransactionClient | PrismaService, id: string, de: S[], data: Prisma.DemandeLogistiqueUncheckedUpdateManyInput) {
    const r = await tx.demandeLogistique.updateMany({ where: { id, statut: { in: de } }, data });
    if (r.count === 0) throw new ConflictException('Cette demande a changé d’état : rechargez-la.');
  }

  private assertEtat(d: DemandeBrute, attendus: S[]) {
    if (!attendus.includes(d.statut)) throw new ConflictException(`Action impossible : la demande est « ${STATUT_LIBELLE[d.statut]} ».`);
  }

  private async assertGestionnaireNonDemandeur(actor: AuthenticatedUser, d: DemandeBrute) {
    await this.gestionnaires.assertGestionnaire(actor);
    if (this.cascade.isActingFor(actor, d.demandeurId)) {
      throw new ForbiddenException('Vous ne pouvez pas traiter votre propre demande : un autre gestionnaire s’en charge.');
    }
  }

  async valider(actor: AuthenticatedUser, id: string) {
    const d = await this.charger(id);
    if (this.cascade.isActingFor(actor, d.demandeurId)) throw new ForbiddenException('Vous ne pouvez pas valider votre propre demande.');
    this.cascade.assertHasDirectAuthorityOver(actor, d.demandeur);
    this.assertEtat(d, [S.A_VALIDER]);
    await this.transition(this.prisma, id, [S.A_VALIDER], { statut: S.A_TRAITER, valideeParId: actor.id, valideeAt: new Date() });
    await this.audit.log({ actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'DemandeLogistique', entityId: id, metadata: { event: 'validation_chef' } });
    await this.notifierGestionnaires(d);
    return this.fiche(actor, id);
  }

  async refuser(actor: AuthenticatedUser, id: string, dto: MotifObligatoireDto) {
    const d = await this.charger(id);
    if (d.statut === S.A_VALIDER) {
      if (this.cascade.isActingFor(actor, d.demandeurId)) throw new ForbiddenException('Vous ne pouvez pas statuer sur votre propre demande (annulez-la).');
      this.cascade.assertHasDirectAuthorityOver(actor, d.demandeur);
    } else {
      this.assertEtat(d, [S.A_TRAITER, S.EN_TRAITEMENT]);
      await this.assertGestionnaireNonDemandeur(actor, d);
    }
    await this.transition(this.prisma, id, [d.statut], { statut: S.REFUSEE, refuseeParId: actor.id, refuseeAt: new Date(), motifRefus: dto.motif });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.REJET,
      entityType: 'DemandeLogistique',
      entityId: id,
      metadata: { etape: d.statut === S.A_VALIDER ? 'chef' : 'gestionnaire', motif: dto.motif },
    });
    if (d.bien) await this.tracerIntervention(actor, d, 'refusee', dto.motif);
    await this.notifications.notify(
      d.demandeurId,
      NotificationType.LOGISTIQUE_DEMANDE_REFUSEE,
      'Demande logistique refusée',
      `${d.objet} — ${dto.motif}`,
      `/logistique?id=${id}`,
      d.objet,
    );
    return this.fiche(actor, id);
  }

  async prendreEnCharge(actor: AuthenticatedUser, id: string) {
    const d = await this.charger(id);
    this.assertEtat(d, [S.A_TRAITER]);
    await this.assertGestionnaireNonDemandeur(actor, d);
    await this.transition(this.prisma, id, [S.A_TRAITER], { statut: S.EN_TRAITEMENT, traiteeParId: actor.id, priseEnChargeAt: new Date() });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'DemandeLogistique', entityId: id, metadata: { event: 'prise_en_charge' } });
    return this.fiche(actor, id);
  }

  /**
   * Traitement : pour un article à stock suivi, la quantité remise sort du
   * stock DANS la même transaction (409 si insuffisant, rien n'est écrit).
   */
  async traiter(actor: AuthenticatedUser, id: string, dto: TraiterDemandeDto) {
    const d = await this.charger(id);
    this.assertEtat(d, [S.EN_TRAITEMENT]);
    await this.assertGestionnaireNonDemandeur(actor, d);
    const stockSuivi = d.type === TypeDemandeLogistique.FOURNITURE && !!d.article?.suiviStock;
    if (dto.quantiteLivree !== undefined && d.type !== TypeDemandeLogistique.FOURNITURE) {
      throw new BadRequestException('La quantité remise ne concerne que les fournitures.');
    }
    const quantiteLivree = d.type === TypeDemandeLogistique.FOURNITURE ? dto.quantiteLivree ?? d.quantite : null;
    if (quantiteLivree !== null && d.quantite !== null && quantiteLivree > d.quantite) {
      throw new BadRequestException(`La quantité remise ne peut pas dépasser la quantité demandée (${d.quantite}).`);
    }
    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, id, [S.EN_TRAITEMENT], {
        statut: S.TRAITEE,
        traiteeParId: actor.id,
        traiteeAt: new Date(),
        quantiteLivree,
        compteRendu: dto.compteRendu ?? null,
      });
      if (stockSuivi && quantiteLivree) {
        await this.referentiel.mouvementDansTransaction(tx, actor, d.article!.id, TypeMouvementStock.SORTIE, quantiteLivree, `Demande de ${d.demandeur.firstName} ${d.demandeur.lastName}`, id);
      }
    });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.VALIDATION,
      entityType: 'DemandeLogistique',
      entityId: id,
      metadata: { event: 'traitee', quantiteLivree, sortieStock: stockSuivi },
    });
    if (stockSuivi) await this.referentiel.verifierSeuil(d.article!.id);
    if (d.bien) await this.tracerIntervention(actor, d, 'traitee', dto.compteRendu ?? null);
    await this.notifications.notify(
      d.demandeurId,
      NotificationType.LOGISTIQUE_DEMANDE_TRAITEE,
      'Demande logistique traitée',
      `${d.objet}${quantiteLivree ? ` — ${quantiteLivree} ${d.article?.unite ?? ''} remis` : ''}${dto.compteRendu ? ` — ${dto.compteRendu}` : ''}`,
      `/logistique?id=${id}`,
      d.objet,
    );
    return this.fiche(actor, id);
  }

  async annuler(actor: AuthenticatedUser, id: string) {
    const d = await this.charger(id);
    if (!this.cascade.isActingFor(actor, d.demandeurId)) throw new ForbiddenException('Seul le demandeur peut annuler sa demande.');
    this.assertEtat(d, [S.A_VALIDER, S.A_TRAITER]);
    await this.transition(this.prisma, id, [S.A_VALIDER, S.A_TRAITER], { statut: S.ANNULEE });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'DemandeLogistique', entityId: id, metadata: { event: 'annulation' } });
    if (d.bien) await this.tracerIntervention(actor, d, 'annulee', null);
    return this.fiche(actor, id);
  }

  private async tracerIntervention(actor: AuthenticatedUser, d: DemandeBrute, event: string, detail: string | null) {
    await this.prisma.mouvementBien.create({
      data: { bienId: d.bien!.id, type: TypeMouvementBien.INTERVENTION, detail: { event, demandeId: d.id, detail }, parId: actor.id },
    });
  }

  // ------------------------------------------------------------ Export

  async exporter(actor: AuthenticatedUser, f: FiltresDemandesDto): Promise<Buffer> {
    const lignes = await this.lister(actor, f);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SI DNPEC';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Demandes logistiques');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Demandeur', key: 'demandeur', width: 26 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'Catégorie', key: 'categorie', width: 22 },
      { header: 'Objet', key: 'objet', width: 40 },
      { header: 'Quantité', key: 'quantite', width: 10 },
      { header: 'Remis', key: 'remis', width: 10 },
      { header: 'Statut', key: 'statut', width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } };
    for (const d of lignes) {
      sheet.addRow({
        date: new Date(d.createdAt).toLocaleDateString('fr-FR'),
        demandeur: `${d.demandeur.firstName} ${d.demandeur.lastName}`,
        type: TYPE_DEMANDE_LIBELLE[d.type],
        categorie: d.categorie.libelle,
        objet: d.objet,
        quantite: d.quantite ?? '',
        remis: d.quantiteLivree ?? '',
        statut: d.statutLibelle,
      });
    }
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.PUBLICATION,
      entityType: 'DemandeLogistique',
      entityId: 'demandes',
      metadata: { event: 'export_excel', filtres: { ...f }, lignes: lignes.length },
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
