import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Hachage de mot de passe (argon2id). Placé dans common/ plutôt que dans
 * auth/ (comme prévu initialement) car users/ en a besoin dès la création
 * manuelle de compte, avant que le module auth n'existe — auth/ réutilisera
 * ce même service pour la connexion et la mise à jour de mot de passe.
 */
@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }

  // Hachage d'un mot de passe aléatoire, calculé une fois : comparé quand le compte n'existe pas, il
  // rend le temps de réponse de la connexion identique (revue de sécurité 2026-10, énumération).
  private factice: Promise<string> | null = null;

  /** Vérification « à blanc » quand le compte est inconnu : même coût qu'une vraie, toujours faux. */
  async verifierFactice(plain: string): Promise<false> {
    this.factice ??= argon2.hash(`factice-${Math.random()}`, { type: argon2.argon2id });
    await argon2.verify(await this.factice, plain).catch(() => false);
    return false;
  }
}
