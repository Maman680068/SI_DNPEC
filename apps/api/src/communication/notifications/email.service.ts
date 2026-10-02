import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { estAdresseDemo } from '../../demo/demo.constantes';

/**
 * Envoi d'email (§7.7 : Nodemailer + Brevo ou SendGrid). Sans SMTP_HOST
 * configuré (cas actuel — aucun fournisseur choisi/provisionné), bascule
 * sur un transport "jsonTransport" qui n'envoie réellement rien : l'email
 * est simplement encodé et journalisé. L'architecture est prête ;
 * l'envoi réel démarrera dès que la CSID choisira un fournisseur et
 * renseignera les variables SMTP_*.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly configured: boolean;
  private dernierEnvoi: Date | null = null;
  private derniereErreur: { date: Date; message: string } | null = null;
  // Performance 2026-10 : emails acceptés par le serveur d'envoi, par jour UTC (quota journalier de
  // Brevo, BREVO_QUOTA_JOUR). Compteur du processus : remis à zéro par un redémarrage.
  private envois = { jour: '', nombre: 0 };
  private readonly quotaJour: number;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.from = config.get<string>('SMTP_FROM', 'no-reply@dnpec.gov.gn');
    this.configured = !!host;
    this.quotaJour = Number(config.get<string>('BREVO_QUOTA_JOUR') ?? 300) || 300;

    const user = config.get<string>('SMTP_USER');
    this.transporter = this.configured
      ? nodemailer.createTransport({
          host,
          port: config.get<number>('SMTP_PORT', 587),
          secure: config.get<string>('SMTP_SECURE') === 'true',
          auth: user ? { user, pass: config.get<string>('SMTP_PASSWORD') } : undefined,
          // Connexions réutilisées d'un email à l'autre (résumé quotidien envoyé par lots).
          pool: true,
          maxConnections: 2,
        })
      : nodemailer.createTransport({ jsonTransport: true });
  }

  async send(to: string, subject: string, text: string, html?: string): Promise<void> {
    // Comptes de démonstration : aucun envoi, jamais (domaine non livrable, mais
    // un envoi vers lui consommerait le quota Brevo et produirait des rejets).
    if (estAdresseDemo(to)) {
      this.logger.log(`Email non envoyé (compte de démonstration) — destinataire=${to}, sujet="${subject}"`);
      return;
    }
    if (!this.configured) {
      // jsonTransport n'envoie réellement rien — journaliser le corps est ce qui rend
      // le docstring ci-dessus ("encodé et journalisé") vrai, et permet de tester en
      // local un lien à usage unique (réinitialisation de mot de passe) sans SMTP réel.
      // Revue de sécurité 2026-10 : le corps (liens à usage unique, contenu métier) n'est jamais
      // écrit dans les journaux d'un service en production, même mal configuré — sauf demande
      // explicite de la suite de bout en bout (EMAIL_JOURNAL_CORPS=1, qui lit les liens envoyés).
      const corps = process.env.NODE_ENV !== 'production' || process.env.EMAIL_JOURNAL_CORPS === '1';
      this.logger.debug(`Email non envoyé (SMTP non configuré) — destinataire=${to}, sujet="${subject}"${corps ? `\n${text}` : ''}`);
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text, html });
      this.dernierEnvoi = new Date();
      // Seuls les emails réellement remis au serveur d'envoi comptent dans le quota.
      const jour = this.dernierEnvoi.toISOString().slice(0, 10);
      if (this.configured) this.envois = { jour, nombre: (this.envois.jour === jour ? this.envois.nombre : 0) + 1 };
    } catch (e) {
      // Supervision (socle N2) : dernier envoi en erreur, sans destinataire ni contenu.
      this.derniereErreur = { date: new Date(), message: (e instanceof Error ? e.message : String(e)).slice(0, 300) };
      throw e;
    }
  }

  /** État pour la supervision : configuration, dernier envoi réussi, dernière erreur (processus courant). */
  etat(): { configure: boolean; dernierEnvoi: Date | null; derniereErreur: { date: Date; message: string } | null; envoisDuJour: number; quotaJour: number } {
    const envoisDuJour = this.envois.jour === new Date().toISOString().slice(0, 10) ? this.envois.nombre : 0;
    return { configure: this.configured, dernierEnvoi: this.dernierEnvoi, derniereErreur: this.derniereErreur, envoisDuJour, quotaJour: this.quotaJour };
  }
}
