/**
 * Données de démonstration (prisma/demo.ts, workflow manuel db-demo.yml) :
 * tout ce qui est créé pour une présentation est repérable par ces marques,
 * et supprimé (ou annulé, réformé, désactivé) par le mode « supprimer ».
 */

/** Domaine des comptes de démonstration : non livrable (TLD réservé .test, RFC 2606). */
export const DOMAINE_DEMO = 'demo.dnpec.test';

/** Préfixe de tout libellé de démonstration (unités, comptes, contenus). */
export const PREFIXE_DEMO = 'TEST — ';

/** Les comptes de démonstration sont suspendus automatiquement après ce délai. */
export const DUREE_DEMO_JOURS = 14;

/** Marque d'audit d'un passage du script (entityType) : la date de la dernière création fait foi. */
export const ENTITE_AUDIT_DEMO = 'Demo';

export function estAdresseDemo(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${DOMAINE_DEMO}`);
}
