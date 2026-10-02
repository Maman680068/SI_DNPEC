/** Type de contenu servi au téléchargement d'un fichier déposé (revue de sécurité 2026-10).
 * Le type est déclaré par le navigateur de la personne qui a déposé le fichier : on ne le renvoie
 * tel quel que s'il fait partie des formats bureautiques usuels ; tout le reste (HTML, SVG, script…)
 * part en `application/octet-stream`, que le navigateur enregistre sans jamais l'interpréter. */
const TYPES_SURS = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/zip',
]);

export function typeServi(declare: string | null | undefined): string {
  const t = (declare ?? '').split(';')[0]!.trim().toLowerCase();
  return TYPES_SURS.has(t) ? t : 'application/octet-stream';
}
