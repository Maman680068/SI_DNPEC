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
}
