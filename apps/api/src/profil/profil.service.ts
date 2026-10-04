import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { chefsLesPlusProches } from '../socle/chefs-proches';
import { CHAMPS_DOSSIER } from '../rh/effectifs.service';
import { completudeDossier } from '../rh/dossiers-synthese.service';

/** Téléphone masqué (« +224 6•• •• •• 41 ») : la page de profil peut être vue par-dessus l'épaule. */
export function telephoneMasque(t: string | null): string | null {
  if (!t) return null;
  const chiffres = t.replace(/\s+/g, '');
  if (chiffres.length < 6) return '••';
  return `${chiffres.slice(0, chiffres.length - 8)} ${chiffres.slice(-8, -7)}•• •• •• ${chiffres.slice(-2)}`.trim();
}

/**
 * Page « Mon profil » (refonte, étape 9) — lecture seule, pour le compte connecté UNIQUEMENT
 * (identité réelle : jamais celle d'un titulaire en intérim) : identité, unité, chef direct (le chef
 * le plus proche, même règle que l'avis de congé), matricule de sa fiche agent, complétude de son
 * propre dossier (mêmes éléments que la synthèse du DRH : niveau 1 et pièces requises, jamais le
 * niveau 2), état de la double authentification. Les sessions, préférences et guides ont leurs routes.
 */
@Injectable()
export class ProfilService {
  constructor(private readonly prisma: PrismaService) {}

  async profil(actor: AuthenticatedUser) {
    const u = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        jobTitle: true,
        divisionId: true,
        sectionId: true,
        celluleId: true,
        supervisorId: true,
        twoFactorEnabled: true,
        division: { select: { name: true } },
        section: { select: { name: true } },
        cellule: { select: { name: true } },
        agent: { select: { matricule: true, matriculeProvisoire: true, fonction: true } },
        personnelFileBasic: { select: { employmentStatus: true, grade: true, echelon: true, categorie: true, serviceStartDate: true } },
        personnelDocuments: { where: { pieceRequiseId: { not: null } }, select: { pieceRequiseId: true } },
      },
    });
    if (!u) throw new NotFoundException('Compte introuvable');
    const [idsChefs, pieces] = await Promise.all([
      chefsLesPlusProches(this.prisma, { id: u.id, divisionId: u.divisionId, sectionId: u.sectionId, celluleId: u.celluleId, supervisorId: u.supervisorId }),
      this.prisma.pieceRequise.findMany({ where: { actif: true }, select: { id: true, libelle: true }, orderBy: { libelle: 'asc' } }),
    ]);
    const chefs = await this.prisma.user.findMany({ where: { id: { in: idsChefs } }, select: { firstName: true, lastName: true } });
    const f = u.personnelFileBasic;
    const fournies = new Set(u.personnelDocuments.map((d) => d.pieceRequiseId).filter((x): x is string => !!x));
    const manquants = [
      ...CHAMPS_DOSSIER.filter(([cle]) => {
        const v = f ? (f as Record<string, unknown>)[cle] : null;
        return v === null || v === undefined || v === '';
      }).map(([, libelle]) => `Renseigner ${libelle.startsWith('date') ? 'la ' : 'le '}${libelle} (auprès du DRH)`),
      ...pieces.filter((p) => !fournies.has(p.id)).map((p) => `Fournir la pièce « ${p.libelle} »`),
    ];
    const unite = u.cellule?.name ?? ([u.section?.name, u.division?.name].filter(Boolean).join(' · ') || null);
    return {
      prenom: u.firstName,
      nom: u.lastName,
      role: u.role,
      fonction: u.agent?.fonction ?? u.jobTitle ?? null,
      email: u.email,
      telephone: telephoneMasque(u.phone),
      unite,
      chefDirect: chefs.length ? chefs.map((c) => `${c.firstName} ${c.lastName}`).join(', ') : null,
      matricule: u.agent ? { valeur: u.agent.matricule, provisoire: u.agent.matriculeProvisoire } : null,
      completude: { pourcentage: completudeDossier(f, pieces.map((p) => p.id), fournies), manquants },
      deuxFacteurs: u.twoFactorEnabled,
    };
  }
}
