export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  attachmentName: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Conversation {
  otherUserId: string;
  lastMessage: DirectMessage;
}

export type AnnouncementScope = 'DNPEC' | 'DIVISION' | 'SECTION' | 'CELLULE' | 'GROUPE_PERSONNALISE';

export interface Announcement {
  id: string;
  authorId: string;
  title: string;
  body: string;
  scope: AnnouncementScope;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
  createdAt: string;
}

export interface AnnouncementReadReceipt {
  id: string;
  announcementId: string;
  userId: string;
  readAt: string;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  scope: AnnouncementScope;
  divisionId?: string;
  sectionId?: string;
  celluleId?: string;
  recipientUserIds?: string[];
}

export const SCOPE_LABEL: Record<AnnouncementScope, string> = {
  DNPEC: 'Toute la DNPEC',
  DIVISION: 'Division',
  SECTION: 'Section',
  CELLULE: 'Cellule',
  GROUPE_PERSONNALISE: 'Groupe personnalisé',
};

/** Portée d'audience (annonces ET sondages — même enum, même autorité de
 * ciblage côté API). Reflète (côté UX seulement — l'autorité réelle est
 * vérifiée par l'API à chaque niveau) ce que *Service.resolveAudienceAndAuthorize
 * accepte pour chaque rôle, pour ne proposer que des portées qui ont une
 * chance d'aboutir. */
export function getAvailableAudienceScopes(role: string): AnnouncementScope[] {
  switch (role) {
    case 'DN':
    case 'DNA':
      return ['DNPEC', 'DIVISION', 'SECTION', 'CELLULE', 'GROUPE_PERSONNALISE'];
    case 'ADMIN_SYSTEME':
      return ['DIVISION', 'SECTION', 'CELLULE', 'GROUPE_PERSONNALISE'];
    case 'CHEF_DIVISION':
      return ['DIVISION', 'SECTION', 'GROUPE_PERSONNALISE'];
    case 'CHEF_SECTION':
      return ['SECTION', 'GROUPE_PERSONNALISE'];
    case 'CHEF_CELLULE':
      return ['CELLULE', 'GROUPE_PERSONNALISE'];
    default:
      return [];
  }
}

/** Valeur contrôlée partagée par AudienceScopeFields — annonces et sondages
 * portent chacun leur propre state applicatif mais soumettent la même forme. */
export interface AudienceScopeValue {
  scope: AnnouncementScope;
  divisionId: string;
  sectionId: string;
  celluleId: string;
  recipientUserIds: string[];
}

/** Fiche de l'interlocuteur (GET api/v1/messages/avec/:id/contexte) : seulement ce que le lecteur peut voir. */
export interface ContexteConversation {
  interlocuteur: { id: string; prenom: string; nom: string; fonction: string; unite: string | null };
  documents: { id: string; titre: string; nomFichier: string | null; version: number | null; chemin: string; lien: string }[];
  taches: { id: string; titre: string; statut: string; echeance: string | null; lien: string }[];
}
