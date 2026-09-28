import { NextResponse } from 'next/server';

// Lu à chaque appel (jamais figé au build) : commit et branche réellement en ligne.
export const dynamic = 'force-dynamic';

/** GET /api/version : commit et branche du frontend déployé (variables fournies par
 * Render ; null en local) — pour vérifier qu'une fusion est bien en ligne. */
export function GET(): NextResponse {
  return NextResponse.json({
    commit: process.env.RENDER_GIT_COMMIT ?? null,
    branche: process.env.RENDER_GIT_BRANCH ?? null,
  });
}
