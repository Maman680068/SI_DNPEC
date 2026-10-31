import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, NotificationType, StatutAgent, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { attributionActiveWhere, LIBELLE_ROLE_FONCTIONNEL } from '../socle/roles-fonctionnels';
import { estAdresseDemo } from '../demo/demo.constantes';
import { ComptesEmailsService } from './comptes-emails.service';

/** Rôles aux droits élevés : un compte sans double authentification y est signalé en premier. */
const ROLES_ELEVES: SystemRole[] = [SystemRole.ADMIN_SYSTEME, SystemRole.DN, SystemRole.DNA, SystemRole.DRH];

/**
 * Comptes et habilitations (écran « Utilisateurs ») : chiffres de tête, et pour chaque compte ses rôles
 * fonctionnels actifs (libellés), l'état de sa double authentification — jamais le secret —, sa dernière
 * connexion (journal des connexions), son sigle d'unité et sa marque de démonstration ; dessous, les agents
 * en activité du socle sans compte (« aucun compte sans agent » : le compte s'ouvre depuis l'agent).
 * Administrateur : tout, avec « Ouvrir un compte », « Envoyer un rappel », « Renvoyer l'invitation » ;
 * DN et DNA : lecture seule ; tout autre profil : 403. Rien n'est emprunté en intérim (une vue de sécurité
 * suit l'identité réelle).
 */
@Injectable()
export class ComptesSyntheseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly emails: ComptesEmailsService,
  ) {}

  private verifierLecture(actor: AuthenticatedUser) {
    const admin = actor.role === SystemRole.ADMIN_SYSTEME;
    const direction = actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
    if (actor.interimForId || (!admin && !direction)) throw new ForbiddenException('Les comptes et habilitations sont consultés par l’administrateur et la Direction.');
    return admin;
  }

  private verifierAdmin(actor: AuthenticatedUser) {
    if (actor.interimForId || actor.role !== SystemRole.ADMIN_SYSTEME) throw new ForbiddenException('Réservé à l’administrateur.');
  }

  /** Dernière connexion réussie par compte (journal des connexions, conservé N mois). */
  private async dernieresConnexions(ids?: string[]) {
    const l = await this.prisma.journalConnexion.groupBy({
      by: ['userId'],
      where: { resultat: 'SUCCES', userId: ids ? { in: ids } : { not: null } },
      _max: { createdAt: true },
    });
    return new Map(l.map((x) => [x.userId as string, x._max.createdAt as Date]));
  }

  async synthese(actor: AuthenticatedUser) {
    const admin = this.verifierLecture(actor);
    const comptes = await this.prisma.user.findMany({
      where: { status: { not: UserStatus.EN_ATTENTE } },
      select: {
        id: true, email: true, role: true, status: true, twoFactorEnabled: true, supervisorId: true,
        division: { select: { code: true } }, section: { select: { code: true } }, cellule: { select: { code: true } },
        attributionsRoles: { where: attributionActiveWhere(), select: { role: true } },
      },
    });
    const [connexions, inscriptions, agents] = await Promise.all([
      this.dernieresConnexions(),
      this.prisma.user.count({ where: { status: UserStatus.EN_ATTENTE } }),
      this.prisma.agent.findMany({
        where: { statut: StatutAgent.EN_ACTIVITE, compte: null },
        select: { id: true, matricule: true, nom: true, prenoms: true, fonction: true, createdAt: true, unite: { select: { code: true, libelle: true } } },
        orderBy: [{ createdAt: 'desc' }, { nom: 'asc' }],
      }),
    ]);
    const lignes = comptes.map((c) => {
      const derniere = connexions.get(c.id) ?? null;
      const actif = c.status === UserStatus.ACTIF;
      return {
        id: c.id,
        rolesFonctionnels: [...new Set(c.attributionsRoles.map((a) => a.role))].map((r) => LIBELLE_ROLE_FONCTIONNEL[r]).sort((a, b) => a.localeCompare(b, 'fr')),
        doubleAuthentification: c.twoFactorEnabled,
        droitsEleves: ROLES_ELEVES.includes(c.role),
        sigleUnite: c.cellule?.code ?? (c.division ? [c.division.code, c.section?.code].filter(Boolean).join(' · ') : c.supervisorId ? 'Direction' : c.role === SystemRole.DN || c.role === SystemRole.DNA ? 'Direction' : null),
        derniereConnexion: derniere ? derniere.toISOString() : null,
        demonstration: estAdresseDemo(c.email),
        renvoyerInvitation: admin && actif && !derniere,
      };
    });
    const parId = new Map(comptes.map((c) => [c.id, c]));
    const actifs = lignes.filter((l) => parId.get(l.id)!.status === UserStatus.ACTIF);
    const suspendus = lignes.filter((l) => parId.get(l.id)!.status === UserStatus.SUSPENDU);
    const sans2fa = actifs.filter((l) => !l.doubleAuthentification);
    return {
      droits: { ouvrirCompte: admin, envoyerRappel: admin, examinerInscriptions: admin },
      chiffres: {
        actifs: actifs.length,
        suspendus: suspendus.length,
        suspendusDemonstration: suspendus.filter((l) => l.demonstration).length,
        inscriptionsAExaminer: inscriptions,
        actifsSansDoubleAuthentification: sans2fa.length,
        droitsElevesSansDoubleAuthentification: sans2fa.filter((l) => l.droitsEleves).length,
        jamaisConnectes: actifs.filter((l) => !l.derniereConnexion).length,
      },
      comptes: lignes,
      agentsSansCompte: agents.map((a) => ({
        id: a.id,
        matricule: a.matricule,
        nom: a.nom,
        prenoms: a.prenoms,
        fonction: a.fonction,
        unite: a.unite ? a.unite.libelle : null,
        dateCreation: a.createdAt.toISOString().slice(0, 10),
      })),
    };
  }

  /**
   * « Envoyer un rappel » : chaque compte actif sans double authentification (hors démonstration) reçoit
   * une notification et un e-mail immédiat qui explique où l'activer (« Mon profil »). Un seul passage
   * au journal pour l'envoi, avec le nombre de personnes prévenues.
   */
  async rappelDoubleAuthentification(actor: AuthenticatedUser) {
    this.verifierAdmin(actor);
    const cibles = (await this.prisma.user.findMany({ where: { status: UserStatus.ACTIF, twoFactorEnabled: false }, select: { id: true, email: true } }))
      .filter((u) => !estAdresseDemo(u.email));
    for (const u of cibles) {
      await this.notifications.notify(
        u.id,
        NotificationType.ROLE_MODIFIE,
        'Activez la double authentification',
        'Votre compte n’est protégé que par votre mot de passe. Ouvrez « Mon profil », rubrique « Double authentification », puis suivez les étapes avec une application d’authentification sur votre téléphone : cela prend deux minutes.',
        '/compte',
        undefined,
        { libelleBouton: 'Ouvrir Mon profil', urgent: true },
      );
    }
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'User', entityId: actor.id, metadata: { event: 'rappel_double_authentification', personnes: cibles.length } });
    return { personnes: cibles.length };
  }

  /** « Renvoyer l'invitation » : compte actif jamais utilisé — nouvel e-mail avec un lien neuf (7 jours). */
  async renvoyerInvitation(actor: AuthenticatedUser, id: string) {
    this.verifierAdmin(actor);
    const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!u || u.status === UserStatus.EN_ATTENTE) throw new NotFoundException('Compte introuvable.');
    if (u.status !== UserStatus.ACTIF) throw new ConflictException('Ce compte n’est pas actif : réactivez-le avant de renvoyer l’invitation.');
    if ((await this.dernieresConnexions([id])).has(id)) throw new ConflictException('Cette personne s’est déjà connectée : utilisez « Mot de passe oublié ? » sur la page de connexion.');
    await this.emails.compteCree(id);
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'User', entityId: id, metadata: { event: 'invitation_renvoyee' } });
    return { envoye: true };
  }
}
