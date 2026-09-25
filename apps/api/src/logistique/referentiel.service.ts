import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, NatureCategorieLogistique, NotificationType, Prisma, TypeMouvementStock } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { GestionnairesLogistiqueService } from './gestionnaires.service';
import { ArticleDto, CreerCategorieDto, ModifierArticleDto, ModifierCategorieDto, MouvementStockDto } from './dto/logistique.dto';

export const ARTICLE_SELECT = {
  id: true,
  categorieId: true,
  categorie: { select: { id: true, code: true, libelle: true, validationChefRequise: true } },
  libelle: true,
  unite: true,
  suiviStock: true,
  stock: true,
  seuilAlerte: true,
  actif: true,
} satisfies Prisma.ArticleFournitureSelect;

type Article = Prisma.ArticleFournitureGetPayload<{ select: typeof ARTICLE_SELECT }>;

/** Vue d'un article : le stock n'est transmis qu'aux gestionnaires (et
 * seulement s'il est suivi) — un demandeur voit l'article, pas le magasin. */
export function vueArticle(a: Article, gestionnaire: boolean) {
  const suivi = a.suiviStock;
  return {
    ...a,
    stock: gestionnaire && suivi ? a.stock : null,
    seuilAlerte: gestionnaire && suivi ? a.seuilAlerte : null,
    sousSeuil: gestionnaire && suivi && a.seuilAlerte !== null && a.stock < a.seuilAlerte,
  };
}

/**
 * Paramétrage de la logistique :
 * - catégories (administrateur système) : nature et réglage « validation du
 *   chef requise » des demandes (décision D9-2) ;
 * - articles de fourniture et mouvements de stock (gestionnaires) : stock
 *   jamais négatif (409, et CHECK en base), alerte sous le seuil (D9-5).
 */
@Injectable()
export class ReferentielLogistiqueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly gestionnaires: GestionnairesLogistiqueService,
  ) {}

  // ------------------------------------------------------------ Catégories

  categories(toutes = false) {
    return this.prisma.categorieLogistique.findMany({
      where: toutes ? {} : { actif: true },
      orderBy: [{ nature: 'asc' }, { libelle: 'asc' }],
    });
  }

  async creerCategorie(actor: AuthenticatedUser, dto: CreerCategorieDto) {
    const existe = await this.prisma.categorieLogistique.findUnique({ where: { code: dto.code } });
    if (existe) throw new ConflictException(`Le code ${dto.code} est déjà utilisé.`);
    const c = await this.prisma.categorieLogistique.create({ data: dto });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'CategorieLogistique', entityId: c.id, metadata: { ...dto } });
    return c;
  }

  async modifierCategorie(actor: AuthenticatedUser, id: string, dto: ModifierCategorieDto) {
    const avant = await this.prisma.categorieLogistique.findUnique({ where: { id } });
    if (!avant) throw new NotFoundException('Catégorie introuvable');
    const c = await this.prisma.categorieLogistique.update({ where: { id }, data: dto });
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'CategorieLogistique',
      entityId: id,
      metadata: { avant: { libelle: avant.libelle, validationChefRequise: avant.validationChefRequise, actif: avant.actif }, apres: { ...dto } },
    });
    return c;
  }

  async categorieActive(id: string, nature: NatureCategorieLogistique) {
    const c = await this.prisma.categorieLogistique.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Catégorie introuvable');
    if (!c.actif) throw new ConflictException(`La catégorie « ${c.libelle} » est désactivée.`);
    if (c.nature !== nature) {
      throw new BadRequestException(
        nature === NatureCategorieLogistique.BIEN ? 'Cette catégorie ne concerne pas des biens inventoriés.' : 'Cette catégorie ne concerne pas des fournitures.',
      );
    }
    return c;
  }

  // ------------------------------------------------------------ Articles

  async articles(actor: AuthenticatedUser) {
    const gestionnaire = await this.gestionnaires.estGestionnaire(actor);
    const liste = await this.prisma.articleFourniture.findMany({
      where: gestionnaire ? {} : { actif: true, categorie: { actif: true } },
      select: ARTICLE_SELECT,
      orderBy: [{ categorie: { libelle: 'asc' } }, { libelle: 'asc' }],
    });
    return liste.map((a) => vueArticle(a, gestionnaire));
  }

  async creerArticle(actor: AuthenticatedUser, dto: ArticleDto) {
    await this.gestionnaires.assertGestionnaire(actor);
    await this.categorieActive(dto.categorieId, NatureCategorieLogistique.FOURNITURE);
    const a = await this.prisma.articleFourniture.create({
      data: { categorieId: dto.categorieId, libelle: dto.libelle, unite: dto.unite ?? 'unité', suiviStock: dto.suiviStock, seuilAlerte: dto.seuilAlerte ?? null },
      select: ARTICLE_SELECT,
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'ArticleFourniture', entityId: a.id, metadata: { ...dto } });
    return vueArticle(a, true);
  }

  async modifierArticle(actor: AuthenticatedUser, id: string, dto: ModifierArticleDto) {
    await this.gestionnaires.assertGestionnaire(actor);
    const avant = await this.prisma.articleFourniture.findUnique({ where: { id } });
    if (!avant) throw new NotFoundException('Article introuvable');
    const a = await this.prisma.articleFourniture.update({ where: { id }, data: dto, select: ARTICLE_SELECT });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'ArticleFourniture', entityId: id, metadata: { ...dto } });
    await this.verifierSeuil(id);
    return vueArticle(a, true);
  }

  /** Journal des mouvements d'un article (gestionnaires). */
  async mouvements(actor: AuthenticatedUser, id: string) {
    await this.gestionnaires.assertGestionnaire(actor);
    return this.prisma.mouvementStock.findMany({
      where: { articleId: id },
      select: {
        id: true,
        type: true,
        quantite: true,
        stockApres: true,
        motif: true,
        demandeId: true,
        createdAt: true,
        par: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Entrée ou sortie manuelle (gestionnaire). Une sortie hors demande exige un motif. */
  async mouvement(actor: AuthenticatedUser, id: string, dto: MouvementStockDto) {
    await this.gestionnaires.assertGestionnaire(actor);
    if (dto.type === TypeMouvementStock.SORTIE && !dto.motif) {
      throw new BadRequestException('Une sortie de stock hors demande exige un motif.');
    }
    const m = await this.prisma.$transaction((tx) => this.mouvementDansTransaction(tx, actor, id, dto.type, dto.quantite, dto.motif ?? null, null));
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'ArticleFourniture',
      entityId: id,
      metadata: { event: dto.type === TypeMouvementStock.ENTREE ? 'entree_stock' : 'sortie_stock', quantite: dto.quantite, stockApres: m.stockApres, motif: dto.motif },
    });
    await this.verifierSeuil(id);
    const a = await this.prisma.articleFourniture.findUniqueOrThrow({ where: { id }, select: ARTICLE_SELECT });
    return vueArticle(a, true);
  }

  /**
   * Mouvement de stock DANS une transaction : la mise à jour est
   * conditionnelle (`stock >= quantite` pour une sortie), donc atomique face
   * à des sorties concurrentes — jamais de stock négatif (409), le CHECK en
   * base restant le filet de sécurité.
   */
  async mouvementDansTransaction(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    articleId: string,
    type: TypeMouvementStock,
    quantite: number,
    motif: string | null,
    demandeId: string | null,
  ) {
    const article = await tx.articleFourniture.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article introuvable');
    if (!article.suiviStock) throw new ConflictException(`Le stock de « ${article.libelle} » n’est pas suivi.`);
    const rows =
      type === TypeMouvementStock.ENTREE
        ? await tx.$queryRaw<{ stock: number }[]>`
            UPDATE "articles_fourniture" SET "stock" = "stock" + ${quantite}, "updatedAt" = now()
            WHERE "id" = ${articleId} RETURNING "stock"`
        : await tx.$queryRaw<{ stock: number }[]>`
            UPDATE "articles_fourniture" SET "stock" = "stock" - ${quantite}, "updatedAt" = now()
            WHERE "id" = ${articleId} AND "stock" >= ${quantite} RETURNING "stock"`;
    if (rows.length === 0) {
      const courant = await tx.articleFourniture.findUniqueOrThrow({ where: { id: articleId }, select: { stock: true } });
      throw new ConflictException(
        `Stock insuffisant pour « ${article.libelle} » : ${courant.stock} ${article.unite} disponible(s), ${quantite} demandé(s).`,
      );
    }
    const stockApres = Number(rows[0]!.stock);
    return tx.mouvementStock.create({
      data: { articleId, type, quantite, stockApres, motif, demandeId, parId: actor.id },
    });
  }

  /**
   * Alerte « stock bas » aux gestionnaires : une fois au passage sous le
   * seuil (anti-doublon `alerteStockAt`), réarmée quand le stock remonte.
   */
  async verifierSeuil(articleId: string): Promise<void> {
    const a = await this.prisma.articleFourniture.findUnique({ where: { id: articleId } });
    if (!a) return;
    const sous = a.suiviStock && a.actif && a.seuilAlerte !== null && a.stock < a.seuilAlerte;
    if (!sous) {
      if (a.alerteStockAt) await this.prisma.articleFourniture.update({ where: { id: articleId }, data: { alerteStockAt: null } });
      return;
    }
    if (a.alerteStockAt) return;
    const pose = await this.prisma.articleFourniture.updateMany({ where: { id: articleId, alerteStockAt: null }, data: { alerteStockAt: new Date() } });
    if (pose.count === 0) return; // déjà alerté par une requête concurrente
    for (const uid of await this.gestionnaires.idsGestionnaires()) {
      await this.notifications.notify(
        uid,
        NotificationType.LOGISTIQUE_STOCK_BAS,
        'Stock bas',
        `${a.libelle} : ${a.stock} ${a.unite} en stock, sous le seuil d’alerte (${a.seuilAlerte}).`,
        `/logistique?onglet=fournitures&id=${a.id}`,
        a.libelle,
      );
    }
  }
}
