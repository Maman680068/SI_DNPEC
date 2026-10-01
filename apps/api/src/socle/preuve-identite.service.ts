import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditAction } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { getReauth, requestContextStorage } from '../common/request-context/request-context';

/** Durée de validité d'une preuve de réauthentification. */
export const DUREE_PREUVE_MINUTES = 10;
export const CODE_REAUTH_REQUISE = 'REAUTH_REQUISE';

type PreuvePayload = { sub: string; purpose: 'reauth' };

/**
 * Réauthentification avant un objet protégé (cahier NIMBA §4.4, §3.2) : la preuve, émise après
 * saisie du mot de passe (et du code si la double authentification est active), voyage dans
 * l'en-tête X-Reauth. Elle est liée à l'identité RÉELLE (en intérim, celle du suppléant).
 * Toute consultation d'un objet protégé est journalisée.
 */
@Injectable()
export class PreuveIdentiteService {
  constructor(
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async emettre(userId: string): Promise<{ preuve: string; expireLe: string }> {
    const preuve = await this.jwt.signAsync({ sub: userId, purpose: 'reauth' } satisfies PreuvePayload, { expiresIn: `${DUREE_PREUVE_MINUTES}m` });
    return { preuve, expireLe: new Date(Date.now() + DUREE_PREUVE_MINUTES * 60e3).toISOString() };
  }

  async estValide(actor: AuthenticatedUser): Promise<boolean> {
    // Hors requête HTTP (script de démonstration, tâche planifiée) : pas d'utilisateur à qui la demander.
    if (!requestContextStorage.getStore()) return true;
    const jeton = getReauth();
    if (!jeton) return false;
    try {
      const p = await this.jwt.verifyAsync<PreuvePayload>(jeton);
      return p.purpose === 'reauth' && p.sub === actor.id;
    } catch {
      return false;
    }
  }

  async exiger(actor: AuthenticatedUser): Promise<void> {
    if (await this.estValide(actor)) return;
    throw new ForbiddenException({
      message: 'Confirmez votre identité (mot de passe) pour ouvrir cet élément protégé.',
      code: CODE_REAUTH_REQUISE,
      etape: 'PROTEGE',
    });
  }

  /** Trace d'une consultation d'objet protégé (sans son contenu). */
  async tracerAcces(actor: AuthenticatedUser, objetType: string, objetId: string, quoi: string): Promise<void> {
    await this.audit.log({ actorId: actor.id, action: AuditAction.VALIDATION, entityType: objetType, entityId: objetId, metadata: { event: 'acces_objet_protege', quoi } });
  }
}
