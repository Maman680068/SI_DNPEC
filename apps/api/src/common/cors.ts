import { Logger } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Origines autorisées à partir de CORS_ORIGIN (liste séparée par des virgules).
 * Le navigateur envoie l'origine sans barre finale (« https://dnpec-web.onrender.com ») :
 * une valeur saisie avec « / » final, des espaces ou une majuscule ne doit pas bloquer
 * silencieusement tous les appels du navigateur (« Failed to fetch » à l'écran).
 * Liste vide = variable absente ou vide → toute origine acceptée (voir main.ts).
 */
export function originesAutorisees(valeur: string | undefined): string[] {
  return (valeur ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean);
}

/** Options CORS de l'API : origines de CORS_ORIGIN (normalisées), refus journalisés une fois par origine. */
export function optionsCors(valeur: string | undefined, logger = new Logger('CORS')): CorsOptions {
  const autorisees = originesAutorisees(valeur);
  logger.log(
    autorisees.length
      ? `Origines autorisées : ${autorisees.join(', ')}`
      : 'CORS_ORIGIN vide : toute origine est autorisée',
  );
  const dejaSignalees = new Set<string>();
  return {
    origin: autorisees.length
      ? (origine, rappel) => {
          // Pas d'en-tête Origin : appel hors navigateur (Route Handlers du web, sonde Render).
          if (!origine || autorisees.includes(origine.toLowerCase())) return rappel(null, true);
          if (!dejaSignalees.has(origine)) {
            dejaSignalees.add(origine);
            logger.warn(
              `Origine refusée : ${origine} — absente de CORS_ORIGIN (${autorisees.join(', ')}). ` +
                'Le navigateur affichera « Failed to fetch » pour chaque appel de cette origine.',
            );
          }
          rappel(null, false);
        }
      : true,
    // Nom des fichiers générés (attestation Word ou PDF selon le modèle) lisible par le frontend.
    exposedHeaders: ['Content-Disposition'],
  };
}
