import * as path from 'path';

/**
 * Fichiers livrés avec l'application : une clé de fichier « integre:<nom> »
 * désigne un fichier de apps/api/assets, présent dans le dépôt et donc dans
 * chaque déploiement. Sert aux scripts exécutés hors du serveur (paramétrage,
 * démonstration), qui ne peuvent pas écrire dans le stockage de l'API.
 * StorageService les lit comme les autres et ne les supprime jamais.
 */
export const PREFIXE_INTEGRE = 'integre:';

export function estIntegre(fileKey: string): boolean {
  return fileKey.startsWith(PREFIXE_INTEGRE);
}

export function cheminIntegre(fileKey: string): string {
  const nom = path.basename(fileKey.slice(PREFIXE_INTEGRE.length));
  // src/common/storage ou dist/common/storage → apps/api/assets
  return path.resolve(__dirname, '../../../assets', nom);
}
