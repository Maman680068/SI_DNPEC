import { SystemRole } from '@prisma/client';
import { estDrh } from '../socle/roles-fonctionnels';

/**
 * Qui crée une réunion directement (S1) : chefs de section, de division et de cellule, DN, DNA,
 * assistants de direction, DRH. Les autres (chargés d'études, administrateur système) la demandent à
 * leur chef le plus proche ; un stagiaire n'a pas accès aux réunions. En intérim, la position empruntée
 * compte (le rôle fonctionnel DRH, lui, ne s'emprunte jamais).
 */
const CREATEURS_DIRECTS: SystemRole[] = [
  SystemRole.CHEF_SECTION,
  SystemRole.CHEF_DIVISION,
  SystemRole.CHEF_CELLULE,
  SystemRole.DN,
  SystemRole.DNA,
  SystemRole.ASSISTANT_DIRECTION,
  SystemRole.DRH,
];

export function creeReunionDirectement(actor: { role: SystemRole; rolesFonctionnels?: string[] }): boolean {
  if (actor.role === SystemRole.STAGIAIRE) return false;
  return CREATEURS_DIRECTS.includes(actor.role) || estDrh(actor as never);
}

export function demandeReunion(actor: { role: SystemRole; rolesFonctionnels?: string[] }): boolean {
  return actor.role !== SystemRole.STAGIAIRE && !creeReunionDirectement(actor);
}
