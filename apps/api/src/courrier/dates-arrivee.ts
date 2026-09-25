import { BadRequestException } from '@nestjs/common';

/** Jour civil (UTC — heure de Conakry) d'un instant : les dates saisies sont
 * des jours, jamais des heures. */
const jour = (d: Date) => d.toISOString().slice(0, 10);

export interface DerogationDate {
  derogationDate?: boolean;
  motifDerogation?: string;
}

/**
 * Contrôle des dates d'une arrivée (enregistrement et correction) :
 * - date de réception dans le futur (horloge du serveur) ;
 * - date du courrier postérieure à sa date de réception.
 * Une réception antérieure (enregistrement tardif) reste normale.
 * Anomalie sans dérogation → 400. Dérogation sans motif → 400.
 * Renvoie le motif à stocker (null s'il n'y a pas d'anomalie).
 */
export function controlerDates(
  d: { dateReception: Date; dateCourrier: Date | null },
  derogation: DerogationDate,
  maintenant: Date = new Date(),
): string | null {
  const motif = derogation.motifDerogation?.trim() ?? '';
  if (derogation.derogationDate && !motif) {
    throw new BadRequestException('Une dérogation sur les dates exige un motif.');
  }
  const anomalies: string[] = [];
  if (jour(d.dateReception) > jour(maintenant)) anomalies.push('la date de réception est dans le futur');
  if (d.dateCourrier && jour(d.dateCourrier) > jour(d.dateReception)) {
    anomalies.push('la date du courrier est postérieure à sa date de réception');
  }
  if (anomalies.length === 0) return null;
  if (!derogation.derogationDate) {
    throw new BadRequestException(
      `Date anormale : ${anomalies.join(' ; ')}. Pour l’enregistrer quand même, confirmez la date et indiquez le motif de la dérogation.`,
    );
  }
  return motif;
}
