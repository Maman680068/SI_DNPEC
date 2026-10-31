import { IsString, Length } from 'class-validator';

/**
 * Message direct envoyé par le navigateur : destinataire et texte seulement. La pièce jointe
 * (clé de stockage, nom) n'est jamais acceptée d'ici — une clé choisie par l'utilisateur pourrait
 * désigner le fichier d'un autre (purge de conservation) ; seul le serveur la pose
 * (`MessagesService.send(..., piece)`).
 */
export class CreateMessageDto {
  @IsString()
  recipientId!: string;

  @IsString()
  @Length(1, 4000)
  body!: string;
}
