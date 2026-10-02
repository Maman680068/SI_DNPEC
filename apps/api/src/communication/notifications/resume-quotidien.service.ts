import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { NotificationChannel, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TachesPlanifieesService } from '../../socle/taches-planifiees.service';
import { EmailService } from './email.service';
import { buildEmailContent } from './email-template';
import { prochainResume } from './notifications.service';
import { PreferencesNotificationDto } from './dto/preferences.dto';

const DEFAUT = { resumeQuotidien: true, heureResume: 7 };
const MAX_LIGNES = 30;

/**
 * Résumé quotidien des notifications (socle N5, §9). Les emails non immédiats sont écrits avec
 * `aEnvoyerLe` (heure du résumé choisie par l'agent) et `sentAt` nul ; la tâche horaire
 * `resume-quotidien` envoie un seul email par agent pour tout ce qui est échu, puis pose `sentAt`.
 * La notification dans l'application reste immédiate. `executer(date)` accepte une date simulée.
 */
@Injectable()
export class ResumeQuotidienService {
  private readonly logger = new Logger('ResumeQuotidien');

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly taches: TachesPlanifieesService,
  ) {}

  async preferences(userId: string) {
    const p = await this.prisma.preferenceNotification.findUnique({ where: { userId }, select: { resumeQuotidien: true, heureResume: true } });
    const enAttente = await this.prisma.notification.count({ where: { userId, channel: NotificationChannel.EMAIL, sentAt: null, aEnvoyerLe: { not: null } } });
    return { ...(p ?? DEFAUT), enAttente };
  }

  /** Changer d'heure ou passer à « Tout immédiatement » reprogramme les emails en attente. */
  async modifier(userId: string, dto: PreferencesNotificationDto) {
    const p = await this.prisma.preferenceNotification.upsert({
      where: { userId },
      create: { userId, ...DEFAUT, ...dto },
      update: dto,
      select: { resumeQuotidien: true, heureResume: true },
    });
    const maintenant = new Date();
    await this.prisma.notification.updateMany({
      where: { userId, channel: NotificationChannel.EMAIL, sentAt: null, aEnvoyerLe: { not: null } },
      // Tout immédiatement : les emails en attente partent au prochain passage (dans l'heure).
      data: { aEnvoyerLe: p.resumeQuotidien ? prochainResume(maintenant, p.heureResume) : maintenant },
    });
    return this.preferences(userId);
  }

  @Cron('0 * * * *')
  async horaire(): Promise<void> {
    await this.taches.suivre('resume-quotidien', () => this.executer(new Date())).catch((e) => this.logger.error(`Résumé quotidien : ${e instanceof Error ? e.message : e}`));
  }

  async executer(maintenant: Date): Promise<{ agents: number; notifications: number }> {
    const dues = await this.prisma.notification.findMany({
      where: { channel: NotificationChannel.EMAIL, sentAt: null, aEnvoyerLe: { lte: maintenant } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, userId: true, title: true, body: true, link: true, createdAt: true, user: { select: { email: true, firstName: true, status: true } } },
    });
    const parAgent = new Map<string, typeof dues>();
    for (const n of dues) parAgent.set(n.userId, [...(parAgent.get(n.userId) ?? []), n]);
    const web = this.config.get<string>('WEB_APP_URL', 'http://localhost:3100');
    for (const [userId, liste] of parAgent) {
      const ids = liste.map((n) => n.id);
      // Marqué avant l'envoi : un échec n'entraîne jamais un second résumé identique.
      const pris = await this.prisma.notification.updateMany({ where: { id: { in: ids }, sentAt: null }, data: { sentAt: maintenant } });
      if (!pris.count) continue;
      const u = liste[0]!.user;
      if (u.status !== UserStatus.ACTIF) continue; // compte suspendu ou désactivé : rien n'est envoyé
      const lignes = liste.slice(0, MAX_LIGNES).map((n) => `• ${n.title} — ${n.body}${n.link ? ` (${web}${n.link})` : ''}`);
      if (liste.length > MAX_LIGNES) lignes.push(`… et ${liste.length - MAX_LIGNES} autre(s) dans l’application.`);
      const { html, text } = buildEmailContent({
        recipientFirstName: u.firstName,
        paragraphs: [`Votre résumé quotidien : ${liste.length} notification(s).`, ...lignes],
        buttonLabel: 'Ouvrir l’espace de travail',
        buttonUrl: `${web}/dashboard`,
        afterButtonParagraphs: [`Les alertes urgentes vous parviennent toujours immédiatement. Pour changer l’heure du résumé ou tout recevoir immédiatement : ${web}/compte/notifications`],
      });
      try {
        await this.email.send(u.email, `Résumé quotidien : ${liste.length} notification(s)`, text, html);
      } catch (e) {
        this.logger.error(`Échec d'envoi du résumé quotidien à ${userId} : ${e instanceof Error ? e.message : e}`);
      }
    }
    return { agents: parAgent.size, notifications: dues.length };
  }
}
