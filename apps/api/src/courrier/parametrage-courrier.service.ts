import { ForbiddenException, Injectable } from '@nestjs/common';
import { RegistreNature, RegistrePortee, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { NumerotationService } from './numerotation.service';
import { RegistresService } from './registres.service';
import { UNITE_DIRECTION } from './unites';
import { etatFamille } from '../rh/familles-actes.service';

const LIBELLE_NATURE: Record<RegistreNature, string> = { ARRIVEE: 'Arrivée', DEPART: 'Départ', ACTE: 'Actes' };
const ORDRE_NATURE: RegistreNature[] = [RegistreNature.ARRIVEE, RegistreNature.DEPART, RegistreNature.ACTE];

/** Registre de démonstration (prisma/demo.ts : TEST-ARR, TEST-DEP…). */
export const estRegistreDemo = (code: string) => code.startsWith('TEST-');

/**
 * Paramétrage du courrier en une lecture (S9c, docs/conception_S9_administration.md) : alertes (registre actif
 * sans personne habilitée active ; famille d'actes RH sans registre utilisable), registres groupés par nature
 * avec le prochain numéro (aperçu sans consommer la séquence), les numéros utilisés dans l'année et la date
 * du dernier (compteurs), les personnes habilitées et la famille d'actes liée ; habilitations groupées par
 * registre, compte inactif signalé. Administrateur système uniquement (droits inchangés) ; configuration et
 * comptages seulement, jamais le contenu d'un courrier.
 */
@Injectable()
export class ParametrageCourrierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numerotation: NumerotationService,
    private readonly registres: RegistresService,
  ) {}

  async vue(actor: AuthenticatedUser, maintenant = new Date()) {
    if (actor.role !== SystemRole.ADMIN_SYSTEME || actor.interimForId) throw new ForbiddenException('Le paramétrage du courrier est réservé à l’administrateur.');
    const annee = maintenant.getFullYear();
    const [registres, habs, compteurs, familles, unites] = await Promise.all([
      this.prisma.registreCourrier.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.habilitationCourrier.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, registreId: true, uniteKey: true, createdAt: true, revoqueeAt: true, user: { select: { id: true, firstName: true, lastName: true, status: true } } },
      }),
      this.prisma.compteurRegistre.findMany({ where: { annee } }),
      this.prisma.familleActeRh.findMany({ orderBy: { libelle: 'asc' }, select: { code: true, libelle: true, registreId: true, registre: { select: { code: true, isActive: true, nature: true, portee: true } } } }),
      this.registres.unites(),
    ]);
    const unite = new Map(unites.map((u) => [u.key, u]));
    const lignes = await Promise.all(registres.map(async (r) => {
      const actives = habs.filter((h) => h.registreId === r.id && !h.revoqueeAt);
      const habilites = actives.map((h) => ({ id: h.user.id, nom: `${h.user.firstName} ${h.user.lastName}`, actif: h.user.status === UserStatus.ACTIF, unite: unite.get(h.uniteKey)?.code ?? null }));
      // Aperçu : Direction (DNPEC), sinon la première unité habilitée (le numéro dépend de l'unité).
      const cle = r.portee === RegistrePortee.DIRECTION ? UNITE_DIRECTION : actives[0]?.uniteKey ?? null;
      const apercu = cle ? await this.numerotation.apercu(r, cle, unite.get(cle)?.code ?? 'UNITE', maintenant) : null;
      const cs = compteurs.filter((c) => c.registreId === r.id && c.dernier > 0);
      const lie = familles.filter((f) => f.registreId === r.id).map((f) => ({ code: f.code, libelle: f.libelle, etat: etatFamille(f.code, f.registre) }));
      return {
        id: r.id,
        code: r.code,
        libelle: r.libelle,
        nature: r.nature,
        portee: r.portee,
        porteeLibelle: r.portee === RegistrePortee.DIRECTION ? 'Direction' : 'Par unité',
        gabarit: r.gabaritNumero,
        actif: r.isActive,
        demonstration: estRegistreDemo(r.code),
        prochainNumero: apercu ? apercu.numero : null,
        prochainNumeroUnite: r.portee === RegistrePortee.UNITE && cle ? unite.get(cle)?.code ?? null : null,
        utilisesAnnee: cs.reduce((n, c) => n + c.dernier, 0),
        dernierLe: cs.length ? new Date(Math.max(...cs.map((c) => c.updatedAt.getTime()))).toISOString() : null,
        habilites,
        sansPersonne: r.isActive && !habilites.some((h) => h.actif),
        familles: lie,
      };
    }));
    const groupes = ORDRE_NATURE.map((n) => ({ nature: n, libelle: LIBELLE_NATURE[n], registres: lignes.filter((l) => l.nature === n) }));
    const parRegistre = registres.map((r) => {
      const hs = habs.filter((h) => h.registreId === r.id);
      const ligne = (h: (typeof habs)[number]) => ({
        id: h.id,
        userId: h.user.id,
        nom: `${h.user.firstName} ${h.user.lastName}`,
        compteActif: h.user.status === UserStatus.ACTIF,
        unite: unite.get(h.uniteKey) ? `${unite.get(h.uniteKey)!.code} — ${unite.get(h.uniteKey)!.libelle}` : h.uniteKey,
        depuis: h.createdAt.toISOString(),
        revoqueeLe: h.revoqueeAt ? h.revoqueeAt.toISOString() : null,
      });
      return {
        registre: { id: r.id, code: r.code, libelle: r.libelle, actif: r.isActive, demonstration: estRegistreDemo(r.code) },
        actives: hs.filter((h) => !h.revoqueeAt).map(ligne),
        historique: hs.filter((h) => h.revoqueeAt).map(ligne),
      };
    }).filter((g) => g.actives.length + g.historique.length > 0 || g.registre.actif);
    return {
      alertes: {
        registresSansPersonne: lignes.filter((l) => l.sansPersonne).map((l) => ({ id: l.id, code: l.code, libelle: l.libelle, demonstration: l.demonstration })),
        famillesSansRegistre: familles.filter((f) => etatFamille(f.code, f.registre) === 'BLOQUEE').map((f) => ({ code: f.code, libelle: f.libelle })),
        lienFamilles: '/rh?onglet=carriere',
      },
      groupes,
      habilitations: parRegistre,
      comptesInactifsHabilites: habs.filter((h) => !h.revoqueeAt && h.user.status !== UserStatus.ACTIF).length,
    };
  }
}
