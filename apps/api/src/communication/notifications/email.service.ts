import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

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

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.from = config.get<string>('SMTP_FROM', 'no-reply@dnpec.gov.gn');
    this.configured = !!host;

    const user = config.get<string>('SMTP_USER');
    this.transporter = this.configured
      ? nodemailer.createTransport({
          host,
          port: config.get<number>('SMTP_PORT', 587),
          secure: config.get<string>('SMTP_SECURE') === 'true',
          auth: user ? { user, pass: config.get<string>('SMTP_PASSWORD') } : undefined,
        })
      : nodemailer.createTransport({ jsonTransport: true });
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.configured) {
      this.logger.debug(`Email non envoyé (SMTP non configuré) — destinataire=${to}, sujet="${subject}"`);
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text });
  }
}
