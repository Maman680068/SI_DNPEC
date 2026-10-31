import { ForbiddenException, Injectable } from '@nestjs/common';
import { EtatBien, StatutDemandeLogistique, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { VehiculesService } from './vehicules.service';

/** Catégories de démonstration (prisma/demo.ts). */
const CATEGORIES_DEMO = ['TST', 'TSF'];
const EN_COURS: StatutDemandeLogistique[] = [StatutDemandeLogistique.A_VALIDER, StatutDemandeLogistique.A_TRAITER, StatutDemandeLogistique.EN_TRAITEMENT];

/**
 * Administration de la logistique en une lecture (S9d, docs/conception_S9_administration.md) : gestionnaires
 * (actifs / inactifs, statut de chacun, conseil « au moins deux »), alerte si aucun n'est actif, circuit d'une
 * demande, catégories avec leur contenu calculé (biens hors réforme, demandes en cours, articles sous le
 * seuil) et le parc de véhicules (non classé par catégorie : à part). Administrateur système (droits
 * inchangés) ; comptages seulement.
 */
@Injectable()
export class AdministrationLogistiqueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicules: VehiculesService,
  ) {}

  async vue(actor: AuthenticatedUser) {
    if (actor.role !== SystemRole.ADMIN_SYSTEME || actor.interimForId) throw new ForbiddenException('L’administration de la logistique est réservée à l’administrateur.');
    const [habs, categories, biens, demandes, articles, parc] = await Promise.all([
      this.prisma.habilitationLogistique.findMany({
        where: { revoqueeAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, createdAt: true, user: { select: { id: true, firstName: true, lastName: true, role: true, status: true } } },
      }),
      this.prisma.categorieLogistique.findMany({ orderBy: [{ nature: 'asc' }, { code: 'asc' }] }),
      this.prisma.bien.groupBy({ by: ['categorieId'], where: { etat: { not: EtatBien.REFORME } }, _count: { _all: true } }),
      this.prisma.demandeLogistique.groupBy({ by: ['categorieId'], where: { statut: { in: EN_COURS } }, _count: { _all: true } }),
      this.prisma.articleFourniture.findMany({ where: { actif: true, suiviStock: true, seuilAlerte: { not: null } }, select: { categorieId: true, stock: true, seuilAlerte: true } }),
      this.vehicules.disponibilite(actor),
    ]);
    const nb = (l: { categorieId: string; _count: { _all: number } }[], id: string) => l.find((x) => x.categorieId === id)?._count._all ?? 0;
    const gestionnaires = habs.map((h) => ({
      habilitationId: h.id,
      userId: h.user.id,
      nom: `${h.user.firstName} ${h.user.lastName}`,
      role: h.user.role,
      actif: h.user.status === UserStatus.ACTIF,
      depuis: h.createdAt.toISOString(),
    }));
    const actifs = gestionnaires.filter((g) => g.actif).length;
    return {
      gestionnaires: { actifs, inactifs: gestionnaires.length - actifs, liste: gestionnaires, conseilDeux: actifs < 2 },
      alerteAucun: actifs === 0,
      circuit: {
        avecValidation: categories.filter((c) => c.actif && c.validationChefRequise).length,
        sansValidation: categories.filter((c) => c.actif && !c.validationChefRequise).length,
        gestionnaireDisponible: actifs > 0,
      },
      categories: categories.map((c) => ({
        id: c.id,
        code: c.code,
        libelle: c.libelle,
        nature: c.nature,
        validationChefRequise: c.validationChefRequise,
        actif: c.actif,
        demonstration: CATEGORIES_DEMO.includes(c.code),
        contenu: {
          biens: nb(biens, c.id),
          demandesEnCours: nb(demandes, c.id),
          articlesSousSeuil: articles.filter((a) => a.categorieId === c.id && a.stock <= (a.seuilAlerte ?? -1)).length,
        },
      })),
      vehicules: { total: parc.total, enMission: parc.enMission },
    };
  }
}
