import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationType, Prisma, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { EmailService } from '../communication/notifications/email.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { AutorisationService } from './autorisation.service';
import { ParametresService } from './parametres.service';
import { TachesPlanifieesService } from './taches-planifiees.service';
import { JournalAuditService } from './journal-audit.service';

export type EtatService = 'NOMINAL' | 'DEGRADE' | 'INDISPONIBLE';
export type Service = { cle: string; libelle: string; etat: EtatService; detail: string };

const CLE_DERNIER_ETAT = 'supervision.dernierEtat';
export const LIEN_SUPERVISION = '/parametrage?onglet=supervision';
const JOUR = 864e5;

/**
 * Supervision (cahier NIMBA SOC-SUP-01 à 10) : état des services, tâches planifiées, sessions,
 * comptes à surveiller, accès refusés, sauvegardes, intégrité du journal d'audit. Aucun objet
 * protégé n'y figure ni n'y est atteignable (SOC-SUP-10). Lecture : administrateur, DN et DNA.
 */
@Injectable()
export class SupervisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    private readonly autorisation: AutorisationService,
    private readonly parametres: ParametresService,
    private readonly taches: TachesPlanifieesService,
    private readonly journalAudit: JournalAuditService,
  ) {}

  /** État des dépendances (aussi exposé à la sonde publique, sans aucune donnée). */
  async services(): Promise<Service[]> {
    const res: Service[] = [];
    const t0 = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const ms = Date.now() - t0;
      res.push({ cle: 'base', libelle: 'Base de données', etat: ms > 1000 ? 'DEGRADE' : 'NOMINAL', detail: `Réponse en ${ms} ms` });
    } catch {
      res.push({ cle: 'base', libelle: 'Base de données', etat: 'INDISPONIBLE', detail: 'Base injoignable' });
      return res;
    }
    try {
      const { fileKey } = await this.storage.save(Buffer.from('supervision'), 'temoin-supervision.txt');
      const lu = await new Promise<string>((ok, ko) => {
        let t = '';
        this.storage.createReadStream(fileKey).on('data', (c) => (t += c.toString())).on('end', () => ok(t)).on('error', ko);
      });
      await this.storage.delete(fileKey);
      res.push({ cle: 'stockage', libelle: 'Stockage des fichiers', etat: lu === 'supervision' ? 'NOMINAL' : 'DEGRADE', detail: lu === 'supervision' ? 'Écriture et relecture d’un fichier témoin réussies' : 'Relecture du fichier témoin incorrecte' });
    } catch (e) {
      res.push({ cle: 'stockage', libelle: 'Stockage des fichiers', etat: 'INDISPONIBLE', detail: `Écriture impossible (${e instanceof Error ? e.message.slice(0, 120) : 'erreur'})` });
    }
    const m = this.email.etat();
    const erreurRecente = m.derniereErreur && (!m.dernierEnvoi || m.derniereErreur.date > m.dernierEnvoi);
    res.push({
      cle: 'email',
      libelle: 'Envoi des emails',
      etat: !m.configure ? 'DEGRADE' : erreurRecente ? 'DEGRADE' : 'NOMINAL',
      detail: !m.configure
        ? 'Serveur d’envoi non configuré : aucun email ne part'
        : erreurRecente
          ? `Dernier envoi en erreur le ${m.derniereErreur!.date.toISOString().slice(0, 16).replace('T', ' ')} UTC : ${m.derniereErreur!.message}`
          : m.dernierEnvoi
            ? `Dernier envoi réussi le ${m.dernierEnvoi.toISOString().slice(0, 16).replace('T', ' ')} UTC`
            : 'Configuré ; aucun envoi depuis le démarrage',
    });
    const taches = await this.taches.dernieres();
    const enEchec = taches.filter((t) => t.derniere?.statut === 'ECHEC');
    const enRetard = taches.filter((t) => t.derniere && Date.now() - +t.derniere.debut > 2 * t.periodeMinutes * 60e3 + 60 * 60e3);
    res.push({
      cle: 'taches',
      libelle: 'Tâches planifiées',
      etat: enEchec.length ? 'DEGRADE' : enRetard.length ? 'DEGRADE' : 'NOMINAL',
      detail: enEchec.length
        ? `En échec : ${enEchec.map((t) => t.libelle).join(', ')}`
        : enRetard.length
          ? `En retard : ${enRetard.map((t) => t.libelle).join(', ')}`
          : 'Dernières exécutions réussies',
    });
    const audit = await this.journalAudit.etat();
    res.push({
      cle: 'audit',
      libelle: 'Journal d’audit',
      etat: !audit.intacte ? 'INDISPONIBLE' : audit.scellementEnRetard > 0 ? 'DEGRADE' : 'NOMINAL',
      detail: !audit.intacte
        ? `Chaîne rompue à l’entrée n° ${audit.rangRompu} : le journal a été altéré`
        : audit.scellementEnRetard > 0
          ? `${audit.scellementEnRetard} entrée(s) non scellée(s) depuis plus de 10 minutes`
          : `Chaîne intacte (${audit.lignesVerifiees} entrées scellées)`,
    });
    return res;
  }

  private async exigerLecture(actor: AuthenticatedUser): Promise<void> {
    await this.autorisation.exiger(actor, {
      action: 'L',
      objet: { type: 'Supervision' },
      positionsAcceptees: [SystemRole.ADMIN_SYSTEME, SystemRole.DN, SystemRole.DNA],
      perimetre: 'IGNORE',
    });
  }

  async tableau(actor: AuthenticatedUser, maintenant = new Date()) {
    await this.exigerLecture(actor);
    const expiration = await this.parametres.valeur('session.expirationJours');
    const alerteJours = await this.parametres.valeur('finPrevue.alerteJours');
    const depuis = (j: number) => new Date(maintenant.getTime() - j * JOUR);
    const personne = { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true } satisfies Prisma.UserSelect;

    const [services, taches, sessions, connexions24h, echecs24h] = await Promise.all([
      this.services(),
      this.taches.dernieres(),
      this.prisma.userSession.count({ where: { revokedAt: null, lastUsedAt: { gte: depuis(expiration) } } }),
      this.prisma.journalConnexion.count({ where: { resultat: 'SUCCES', createdAt: { gte: depuis(1) } } }),
      this.prisma.journalConnexion.count({ where: { resultat: 'ECHEC', createdAt: { gte: depuis(1) } } }),
    ]);

    // Comptes à surveiller (SOC-SUP-05) : jamais de contenu, seulement l'identité et le motif.
    const [enAttente, jamaisConnectes, inactifs, suspendus, finsProches] = await Promise.all([
      this.prisma.user.findMany({ where: { status: UserStatus.EN_ATTENTE, createdAt: { lt: depuis(7) } }, select: personne, take: 50, orderBy: { createdAt: 'asc' } }),
      this.prisma.user.findMany({ where: { status: UserStatus.ACTIF, createdAt: { lt: depuis(7) }, sessions: { none: {} } }, select: personne, take: 50, orderBy: { createdAt: 'asc' } }),
      this.prisma.user.findMany({
        where: { status: UserStatus.ACTIF, sessions: { some: {} }, NOT: { sessions: { some: { lastUsedAt: { gte: depuis(90) } } } } },
        select: personne,
        take: 50,
      }),
      this.prisma.user.findMany({ where: { status: UserStatus.SUSPENDU }, select: personne, take: 50 }),
      this.prisma.agent.findMany({
        where: { statut: 'EN_ACTIVITE', dateFinPrevue: { gte: depuis(1), lte: new Date(maintenant.getTime() + alerteJours * JOUR) } },
        select: { id: true, nom: true, prenoms: true, dateFinPrevue: true, natureFinPrevue: true, finConfirmeeAt: true },
        orderBy: { dateFinPrevue: 'asc' },
        take: 50,
      }),
    ]);
    const surveiller = [
      ...enAttente.map((u) => ({ ...u, motif: 'Inscription en attente depuis plus de 7 jours' })),
      ...jamaisConnectes.map((u) => ({ ...u, motif: 'Compte actif jamais utilisé (plus de 7 jours)' })),
      ...inactifs.map((u) => ({ ...u, motif: 'Aucune connexion depuis 90 jours' })),
      ...suspendus.map((u) => ({ ...u, motif: 'Compte suspendu' })),
    ].map((u) => ({ id: u.id, nom: `${u.firstName} ${u.lastName}`, email: u.email, role: u.role, motif: u.motif }));

    // Accès refusés (SOC-SUP-06) : comptés et consultables, sans le contenu de l'objet refusé.
    const refus = async (j: number) =>
      (await this.prisma.accesRefuse.groupBy({ by: ['etape'], where: { createdAt: { gte: depuis(j) } }, _count: { _all: true } })).map((g) => ({ etape: g.etape ?? 'AUTRE', nombre: g._count._all }));
    const [refus24h, refus7j, refus30j, derniersRefus] = await Promise.all([
      refus(1),
      refus(7),
      refus(30),
      this.prisma.accesRefuse.findMany({ orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, createdAt: true, userId: true, methode: true, route: true, etape: true, objetType: true, motif: true } }),
    ]);
    const noms = new Map(
      (await this.prisma.user.findMany({ where: { id: { in: derniersRefus.map((r) => r.userId).filter((x): x is string => !!x) } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
    );
    const { testRestauration } = await this.parametres.lister(actor);

    return {
      droits: { peutDeclarerTest: actor.role === SystemRole.ADMIN_SYSTEME && !actor.interimForId },
      genereLe: maintenant,
      etatGlobal: services.some((s) => s.etat === 'INDISPONIBLE') ? 'INDISPONIBLE' : services.some((s) => s.etat === 'DEGRADE') ? 'DEGRADE' : 'NOMINAL',
      services,
      taches,
      sessions: { ouvertes: sessions, expirationJours: expiration },
      connexions: { reussies24h: connexions24h, echecs24h },
      sauvegardes: {
        gestion: 'Sauvegardes quotidiennes automatiques de la base par l’hébergeur (Render), conservées selon l’offre souscrite ; sauvegarde manuelle avant chaque mise à jour (guide d’exploitation, § 2).',
        testRestauration,
        testEnRetard: !testRestauration || Date.now() - +new Date(testRestauration.date) > 180 * JOUR,
      },
      comptesASurveiller: surveiller,
      finsProches: finsProches.map((a) => ({ agentId: a.id, nom: `${a.prenoms} ${a.nom}`, date: a.dateFinPrevue, nature: a.natureFinPrevue, confirmee: !!a.finConfirmeeAt })),
      accesRefuses: {
        parPeriode: { '24h': refus24h, '7j': refus7j, '30j': refus30j },
        derniers: derniersRefus.map((r) => ({ id: r.id, date: r.createdAt, compte: r.userId ? noms.get(r.userId) ?? 'Compte inconnu' : 'Non connecté', methode: r.methode, route: r.route, etape: r.etape ?? 'AUTRE', objetType: r.objetType, motif: r.motif })),
      },
    };
  }

  /**
   * Toutes les 10 minutes : un service qui passe en état dégradé ou indisponible alerte les
   * administrateurs (notification et email), une fois par changement d'état (SOC-SUP-07).
   */
  @Cron('*/10 * * * *')
  async surveillerPeriodique(): Promise<void> {
    await this.taches.suivre('supervision', () => this.surveiller());
  }

  async surveiller(): Promise<{ alertes: number; etats: Record<string, EtatService> }> {
    const services = await this.services();
    const etats = Object.fromEntries(services.map((s) => [s.cle, s.etat])) as Record<string, EtatService>;
    const ligne = await this.prisma.parametre.findUnique({ where: { cle: CLE_DERNIER_ETAT } });
    const avant = (ligne?.valeur ?? {}) as Record<string, EtatService>;
    const degrades = services.filter((s) => s.etat !== 'NOMINAL' && avant[s.cle] !== s.etat);
    await this.prisma.parametre.upsert({ where: { cle: CLE_DERNIER_ETAT }, create: { cle: CLE_DERNIER_ETAT, valeur: etats }, update: { valeur: etats } });
    if (degrades.length) {
      const admins = (await this.prisma.user.findMany({ where: { role: SystemRole.ADMIN_SYSTEME, status: UserStatus.ACTIF }, select: { id: true } })).map((u) => u.id);
      await this.notifications.notifyMany(
        admins,
        NotificationType.DOSSIER_ERREUR_SIGNALEE,
        'Supervision : service en difficulté',
        degrades.map((s) => `${s.libelle} : ${s.etat === 'INDISPONIBLE' ? 'indisponible' : 'dégradé'} — ${s.detail}`).join(' ; '),
        LIEN_SUPERVISION,
        undefined,
        { libelleBouton: 'Voir la supervision' },
      );
    }
    return { alertes: degrades.length, etats };
  }
}
