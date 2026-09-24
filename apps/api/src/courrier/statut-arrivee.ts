import { ArriveeStatut, ImputationNature, ImputationStatut, Prisma } from '@prisma/client';

type Db = Prisma.TransactionClient;

/**
 * Statut dérivé d'une arrivée après une imputation ou un traitement :
 * ENREGISTRE (aucune imputation) → IMPUTE → TRAITE (toutes les imputations
 * d'ATTRIBUTION traitées). Sans effet sur une arrivée CLASSEE ou ANNULEE.
 * Fonction simple (pas un service) : aussi appelée par TasksService.validate
 * pour la clôture automatique d'une imputation convertie en tâche, sans
 * dépendance de module (même principe que Decision, D2).
 */
export async function recalculerStatutArrivee(db: Db, courrierId: string): Promise<void> {
  const a = await db.courrierArrivee.findUnique({
    where: { id: courrierId },
    select: { statut: true, imputations: { select: { nature: true, statut: true } } },
  });
  if (!a || a.statut === ArriveeStatut.ANNULE || a.statut === ArriveeStatut.CLASSE) return;
  const attributions = a.imputations.filter((i) => i.nature === ImputationNature.ATTRIBUTION);
  const next =
    a.imputations.length === 0
      ? ArriveeStatut.ENREGISTRE
      : attributions.length > 0 && attributions.every((i) => i.statut === ImputationStatut.TRAITEE)
        ? ArriveeStatut.TRAITE
        : ArriveeStatut.IMPUTE;
  if (next !== a.statut) {
    await db.courrierArrivee.update({ where: { id: courrierId }, data: { statut: next } });
  }
}
