import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../communication/notifications/email.service';
import { buildEmailContent } from '../communication/notifications/email-template';
import { creerLienPremierAcces } from '../communication/notifications/lien-premier-acces';

/** Libellés des rôles dans les emails (mêmes que l'écran Utilisateurs, apps/web/lib/users/types.ts). */
const LIBELLE_ROLE: Record<SystemRole, string> = {
  DN: 'Directeur National',
  DNA: 'Directeur National Adjoint',
  CHEF_DIVISION: 'Chef de Division',
  CHEF_SECTION: 'Chef de Section',
  CHEF_CELLULE: 'Chef de Cellule',
  AGENT: 'Agent / Chargé d’Études',
  ADMIN_SYSTEME: 'Administrateur Système',
  ASSISTANT_DIRECTION: 'Assistant(e) de Direction',
  DRH: 'Directeur des Ressources Humaines',
  STAGIAIRE: 'Stagiaire',
};

type Destinataire = { email: string; firstName: string };

/**
 * Emails liés au cycle de vie d'un compte : inscription approuvée ou rejetée,
 * compte créé par l'administrateur. Envoyés APRÈS l'action en base : un échec
 * d'envoi (Brevo indisponible, quota, adresse refusée) ne l'annule jamais et
 * ne la fait pas échouer (A7) — il est seulement journalisé.
 *
 * Pas de notification in-app : la personne n'a pas encore de session au moment
 * de l'email (inscription en attente, compte tout juste créé), et, en cas de
 * rejet, son compte n'existe plus.
 */
@Injectable()
export class ComptesEmailsService {
  private readonly logger = new Logger(ComptesEmailsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  private get webAppUrl(): string {
    return this.config.get<string>('WEB_APP_URL', 'http://localhost:3100');
  }

  /** Inscription approuvée : rôle, unité, bouton « Se connecter ». */
  async inscriptionApprouvee(userId: string): Promise<void> {
    await this.envoyerSansBloquer('approbation', userId, async () => {
      const { user, unite } = await this.profil(userId);
      const { html, text } = buildEmailContent({
        recipientFirstName: user.firstName,
        paragraphs: [
          'Votre demande d’accès au SI DNPEC a été approuvée : votre compte est actif.',
          `Rôle : ${LIBELLE_ROLE[user.role]}.`,
          `Unité : ${unite}.`,
          'Connectez-vous avec l’adresse email et le mot de passe choisis lors de votre demande.',
        ],
        buttonLabel: 'Se connecter',
        buttonUrl: `${this.webAppUrl}/login`,
        afterButtonParagraphs: [
          'Mot de passe oublié ? Utilisez « Mot de passe oublié ? » sur la page de connexion. Une fois connecté, la page « Aide » du menu vous guide pas à pas.',
        ],
      });
      return { to: user.email, subject: 'Votre compte SI DNPEC est activé', text, html };
    });
  }

  /**
   * Inscription rejetée (le compte en attente est supprimé : les coordonnées sont
   * passées par l'appelant). Le motif n'apparaît que si l'administrateur en a saisi un.
   */
  async inscriptionRejetee(personne: Destinataire, motif?: string): Promise<void> {
    await this.envoyerSansBloquer('rejet', personne.email, async () => {
      const { html, text } = buildEmailContent({
        recipientFirstName: personne.firstName,
        paragraphs: [
          'Votre demande d’accès au SI DNPEC n’a pas été retenue.',
          ...(motif ? [`Motif indiqué par l’administrateur : ${motif}`] : []),
          `Vous pouvez faire une nouvelle demande à tout moment : ${this.webAppUrl}/register`,
        ],
      });
      return { to: personne.email, subject: 'Votre demande d’accès au SI DNPEC', text, html };
    });
  }

  /**
   * Compte créé par l'administrateur : rôle, unité et lien pour choisir son
   * mot de passe (7 jours) — le mot de passe saisi par l'administrateur reste
   * valable tant que la personne ne l'a pas changé.
   */
  async compteCree(userId: string): Promise<void> {
    await this.envoyerSansBloquer('creation', userId, async () => {
      const { user, unite } = await this.profil(userId);
      const lien = await creerLienPremierAcces(this.prisma, this.webAppUrl, user.id);
      const { html, text } = buildEmailContent({
        recipientFirstName: user.firstName,
        paragraphs: [
          'Un compte a été créé pour vous sur le SI DNPEC, le système d’information interne de la DNPEC.',
          `Rôle : ${LIBELLE_ROLE[user.role]}.`,
          `Unité : ${unite}.`,
          'Pour choisir votre mot de passe, cliquez sur le bouton ci-dessous. Ce lien est valable 7 jours.',
        ],
        buttonLabel: 'Choisir mon mot de passe',
        buttonUrl: lien,
        afterButtonParagraphs: [
          'Si l’administrateur vous a communiqué un mot de passe provisoire, il fonctionne aussi. Si ce lien a expiré, utilisez « Mot de passe oublié ? » sur la page de connexion.',
        ],
      });
      return { to: user.email, subject: 'Votre compte SI DNPEC a été créé', text, html };
    });
  }

  private async profil(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        role: true,
        division: { select: { name: true } },
        section: { select: { name: true } },
        cellule: { select: { name: true } },
        supervisor: { select: { firstName: true, lastName: true } },
      },
    });
    const unite = user.cellule
      ? user.cellule.name
      : user.division
        ? [user.division.name, user.section?.name].filter(Boolean).join(' — ')
        : user.supervisor
          ? `auprès de ${user.supervisor.firstName} ${user.supervisor.lastName}`
          : 'Direction';
    return { user, unite };
  }

  private async envoyerSansBloquer(
    quoi: 'approbation' | 'rejet' | 'creation',
    qui: string,
    preparer: () => Promise<{ to: string; subject: string; text: string; html: string }>,
  ): Promise<void> {
    try {
      const m = await preparer();
      await this.email.send(m.to, m.subject, m.text, m.html);
    } catch (error) {
      this.logger.error(
        `Échec d'envoi de l'email de compte (${quoi}) pour ${qui} : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
