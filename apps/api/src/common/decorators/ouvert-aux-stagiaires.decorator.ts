import { SetMetadata } from '@nestjs/common';

export const OUVERT_AUX_STAGIAIRES_KEY = 'ouvertAuxStagiaires';

/**
 * Ouvre une route (ou tout un contrôleur) au rôle STAGIAIRE, fermé par défaut
 * (StagiaireGuard). Le service applique ensuite ses propres règles : une route
 * ouverte ne donne à un stagiaire que ce que le service accorde à tout compte
 * (ses tâches, ses messages, son dossier...).
 */
export const OuvertAuxStagiaires = () => SetMetadata(OUVERT_AUX_STAGIAIRES_KEY, true);
