import { Injectable } from '@nestjs/common';
import { ActeStatut, ArriveeStatut } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ArriveesService } from './arrivees.service';
import { ActesService } from './actes.service';

/**
 * Ce qui attend la personne connectée dans le courrier — calculé à partir des
 * MÊMES listes que l'écran (matrice de visibilité et droits d'action), jamais
 * par une requête parallèle qui pourrait compter ce qu'elle ne voit pas.
 */
@Injectable()
export class CourrierTableauDeBordService {
  constructor(
    private readonly arrivees: ArriveesService,
    private readonly actes: ActesService,
  ) {}

  async pour(actor: AuthenticatedUser) {
    const [arrivees, actes] = await Promise.all([this.arrivees.lister(actor, {}), this.actes.lister(actor, {})]);
    const now = new Date();
    // Mêmes droits que ceux qu'affiche l'écran (« À faire ») : le compteur et la
    // liste ne peuvent pas diverger.
    const mesImputations = arrivees.flatMap((a) => a.imputations.filter((i) => i.droits.traiter));
    return {
      aImputer: arrivees.filter((a) => a.statut === ArriveeStatut.ENREGISTRE && a.droits.imputer).length,
      aTraiter: mesImputations.length,
      enRetard: mesImputations.filter((i) => i.echeance && i.echeance < now).length,
      aViser: actes.filter((a) => a.droits.viser).length,
      aSigner: actes.filter((a) => a.droits.signer).length,
      aExpedier: actes.filter((a) => a.droits.expedier).length,
      priseDeConnaissance: actes.filter((a) => a.droits.prendreConnaissance).length,
      brouillons: actes.filter((a) => a.droits.modifier).length,
      // Vue du registre (bande de compteurs de la page Courrier) : décompte par statut des
      // MÊMES listes visibles — jamais plus que ce que la personne voit à l'écran.
      arriveesEnAttente: arrivees.filter((a) => a.statut === ArriveeStatut.ENREGISTRE).length,
      visasEnCours: actes.filter((a) => a.statut === ActeStatut.EN_VISA).length,
      actesASigner: actes.filter((a) => a.statut === ActeStatut.A_SIGNER).length,
      actesAExpedier: actes.filter((a) => a.statut === ActeStatut.SIGNE).length,
    };
  }
}
