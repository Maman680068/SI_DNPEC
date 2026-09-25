import { BadRequestException } from '@nestjs/common';
import { SystemRole } from '@prisma/client';

/** Libellés des rôles (historique de carrière, notifications, messages). */
export const ROLE_LIBELLE: Record<SystemRole, string> = {
  DN: 'Directeur National',
  DNA: 'Directeur National Adjoint',
  CHEF_DIVISION: 'Chef de Division',
  CHEF_SECTION: 'Chef de Section',
  CHEF_CELLULE: 'Chef de Cellule',
  AGENT: 'Chargé d’Études',
  ASSISTANT_DIRECTION: 'Assistant(e) de Direction',
  ADMIN_SYSTEME: 'Administrateur Système',
  DRH: 'Directeur des Ressources Humaines',
};

export interface RattachementRole {
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
  supervisorId: string | null;
}

/**
 * Rattachement exigé par chaque rôle (§2) — règle SERVEUR, jusqu'ici portée
 * seulement par l'écran (OrgAttachmentFields). Normalise la saisie : un champ
 * sans objet pour le rôle est effacé, un champ exigé manquant → 400.
 */
export function rattachementPourRole(role: SystemRole, saisie: Partial<RattachementRole>): RattachementRole {
  const d = saisie.divisionId ?? null;
  const s = saisie.sectionId ?? null;
  const c = saisie.celluleId ?? null;
  const sup = saisie.supervisorId ?? null;
  const exige = (ok: boolean, message: string) => {
    if (!ok) throw new BadRequestException(message);
  };
  switch (role) {
    case SystemRole.DN:
    case SystemRole.DNA:
      return { divisionId: null, sectionId: null, celluleId: null, supervisorId: null };
    case SystemRole.CHEF_DIVISION:
      exige(!!d, 'Un Chef de Division est rattaché à une Division.');
      return { divisionId: d, sectionId: null, celluleId: null, supervisorId: null };
    case SystemRole.CHEF_SECTION:
      exige(!!d && !!s, 'Un Chef de Section est rattaché à une Division et à une de ses Sections.');
      return { divisionId: d, sectionId: s, celluleId: null, supervisorId: null };
    case SystemRole.CHEF_CELLULE:
      exige(!!c, 'Un Chef de Cellule est rattaché à une Cellule.');
      return { divisionId: null, sectionId: null, celluleId: c, supervisorId: null };
    case SystemRole.AGENT:
      exige(!!d !== !!c, 'Un Chargé d’Études est rattaché à une Division (section facultative) ou à une Cellule.');
      return d ? { divisionId: d, sectionId: s, celluleId: null, supervisorId: null } : { divisionId: null, sectionId: null, celluleId: c, supervisorId: null };
    case SystemRole.ASSISTANT_DIRECTION:
      exige(!!sup, 'Un(e) Assistant(e) de Direction est rattaché(e) à un superviseur (DN, DNA ou Chef de Cellule).');
      return { divisionId: null, sectionId: null, celluleId: null, supervisorId: sup };
    case SystemRole.DRH:
    case SystemRole.ADMIN_SYSTEME:
      return { divisionId: null, sectionId: null, celluleId: c, supervisorId: null };
  }
}
