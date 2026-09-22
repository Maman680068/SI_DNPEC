import { Prisma } from '@prisma/client';

/**
 * Clés de champs scalaires soumis au statut "à vérifier" (voir schema.prisma,
 * en-tête du module Dossier du personnel). `jobDescription` et
 * `emergencyContact` regroupent plusieurs colonnes DB sous un seul concept
 * pour l'agent (un fichier / un contact), pas un statut par colonne.
 */
export const BASIC_FIELD_KEYS = ['employmentStatus', 'grade', 'echelon', 'serviceStartDate', 'jobDescription'] as const;
export const SENSITIVE_FIELD_KEYS = ['personalAddress', 'personalPhone', 'personalEmail', 'emergencyContact'] as const;

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, boolean> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, boolean>) };
  }
  return {};
}

/** Repasse les clés données à `false` ("à vérifier"), en conservant le statut des
 * autres champs déjà présents — jamais appelé avec des clés inconnues du niveau. */
export function markFieldsUnverified(
  current: Prisma.JsonValue | null | undefined,
  changedKeys: readonly string[],
): Prisma.InputJsonValue {
  const next = asRecord(current);
  for (const key of changedKeys) next[key] = false;
  return next;
}

/** "Confirmer mes informations" — bascule tous les champs connus du niveau à `true`. */
export function markAllFieldsVerified(allKeys: readonly string[]): Prisma.InputJsonValue {
  const next: Record<string, boolean> = {};
  for (const key of allKeys) next[key] = true;
  return next;
}
