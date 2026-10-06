import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditAction, Prisma, StatutTravailCalcul, StatutVersionModele, TypeTravailCalcul } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { StorageService } from '../common/storage/storage.service';
import { ParametresService } from '../socle/parametres.service';
import { CalculClient, CalculInjoignable, CalculRefuse } from './calcul.client';
import { FicheModele } from './paquet';

export type ControleVersion = { id: string; libelle: string; type: 'bloquant' | 'alerte'; ok: boolean; valeur: string; seuil: string | null };

/** Délai au-delà duquel un travail « en cours » est réputé perdu (API redémarrée pendant le calcul). */
const PERDU_APRES_MS = 15 * 60_000;

/**
 * File de travaux du service de calcul (en base) : vérification d'un paquet déposé, exécution d'un
 * scénario. Un seul travail à la fois (le service gratuit n'a qu'une fraction de processeur).
 * Le service s'endort après 15 minutes : le premier appel le réveille (étape « REVEIL ») ; s'il ne
 * répond pas, le travail est remis en file et relancé (calcul.delaiRelanceSecondes) jusqu'à
 * calcul.tentativesMax essais, puis déclaré en échec. Un travail perdu (API redémarrée) est repris.
 */
@Injectable()
export class TravauxCalculService implements OnModuleInit {
  private readonly logger = new Logger('TravauxCalcul');
  private occupe = false;
  private relance = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly calcul: CalculClient,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly parametres: ParametresService,
  ) {}

  /** Au démarrage : un travail resté « en cours » a été interrompu par l'arrêt de l'API ; il repart en file. */
  async onModuleInit(): Promise<void> {
    await this.prisma.travailCalcul
      .updateMany({ where: { statut: StatutTravailCalcul.EN_COURS }, data: { statut: StatutTravailCalcul.EN_FILE, etape: null, prochaineTentativeLe: new Date() } })
      .catch(() => undefined);
    this.declencher();
  }

  async creer(type: TypeTravailCalcul, versionId: string, demandeurId: string, scenario?: Prisma.InputJsonValue, tx?: Prisma.TransactionClient) {
    const t = await (tx ?? this.prisma).travailCalcul.create({ data: { type, versionId, demandeurId, scenario }, select: { id: true } });
    if (!tx) this.declencher();
    return t;
  }

  /** Lance le traitement de la file sans attendre (appel après création d'un travail). */
  declencher(): void {
    setImmediate(() => void this.traiterFile().catch((e) => this.logger.error(e instanceof Error ? e.message : String(e))));
  }

  /** Filet de sécurité : relances programmées et travaux perdus, toutes les 30 secondes. */
  @Cron('*/30 * * * * *')
  async reprendre(): Promise<void> {
    await this.prisma.travailCalcul.updateMany({
      where: { statut: StatutTravailCalcul.EN_COURS, debuteLe: { lt: new Date(Date.now() - PERDU_APRES_MS) } },
      data: { statut: StatutTravailCalcul.EN_FILE, etape: null, prochaineTentativeLe: new Date() },
    });
    await this.traiterFile();
  }

  async traiterFile(): Promise<number> {
    if (this.occupe) {
      this.relance = true;
      return 0;
    }
    this.occupe = true;
    let n = 0;
    try {
      do {
        this.relance = false;
        for (;;) {
          const id = await this.prendre();
          if (!id) break;
          await this.traiter(id);
          n++;
        }
      } while (this.relance);
    } finally {
      this.occupe = false;
    }
    return n;
  }

  /** Prend le plus ancien travail dû (verrou SKIP LOCKED : jamais deux fois le même). */
  private async prendre(): Promise<string | null> {
    const lignes = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE "travaux_calcul" SET "statut" = 'EN_COURS', "etape" = 'REVEIL', "tentatives" = "tentatives" + 1,
        "debuteLe" = COALESCE("debuteLe", now())
      WHERE "id" = (
        SELECT "id" FROM "travaux_calcul" WHERE "statut" = 'EN_FILE' AND "prochaineTentativeLe" <= now()
        ORDER BY "enFileLe" LIMIT 1 FOR UPDATE SKIP LOCKED
      ) RETURNING "id"`;
    return lignes[0]?.id ?? null;
  }

  private async traiter(id: string): Promise<void> {
    const t = await this.prisma.travailCalcul.findUniqueOrThrow({
      where: { id },
      include: { version: { select: { id: true, empreinte: true, fileKey: true, fiche: true, statut: true, modeleId: true } } },
    });
    try {
      await this.calcul.sante();
      await this.prisma.travailCalcul.update({ where: { id }, data: { etape: 'CALCUL' } });
      const lireZip = () => this.storage.readBuffer(t.version.fileKey);
      const t0 = Date.now();
      if (t.type === TypeTravailCalcul.VERIFICATION) {
        const r = await this.calcul.verifier(await lireZip(), t.version.empreinte);
        await this.finirVerification(t.id, t.demandeurId, t.version.id, t.version.fiche as unknown as FicheModele, r, Date.now() - t0);
      } else {
        const r = await this.calcul.executer(t.version.empreinte, t.scenario, lireZip);
        await this.finirExecution(t.id, r, Date.now() - t0);
      }
    } catch (e) {
      if (e instanceof CalculInjoignable) await this.reporter(t.id, t.tentatives, e.message);
      else if (e instanceof CalculRefuse) await this.echec(t.id, t.demandeurId, t.versionId, t.type, e.message);
      else await this.echec(t.id, t.demandeurId, t.versionId, t.type, `Erreur interne : ${e instanceof Error ? e.message.slice(0, 200) : 'inconnue'}`);
    }
  }

  private async reporter(id: string, tentatives: number, message: string): Promise<void> {
    const max = await this.parametres.valeur('calcul.tentativesMax');
    if (tentatives >= max) {
      const t = await this.prisma.travailCalcul.findUniqueOrThrow({ where: { id }, select: { demandeurId: true, versionId: true, type: true } });
      await this.echec(id, t.demandeurId, t.versionId, t.type, `Service de calcul injoignable après ${tentatives} essai(s) : ${message}`);
      return;
    }
    const delai = await this.parametres.valeur('calcul.delaiRelanceSecondes');
    await this.prisma.travailCalcul.update({
      where: { id },
      data: { statut: StatutTravailCalcul.EN_FILE, etape: 'REVEIL', message, prochaineTentativeLe: new Date(Date.now() + delai * 1000) },
    });
  }

  private async echec(id: string, demandeurId: string, versionId: string, type: TypeTravailCalcul, message: string): Promise<void> {
    await this.prisma.travailCalcul.update({
      where: { id },
      data: { statut: StatutTravailCalcul.ECHEC, etape: null, message: message.slice(0, 1000), termineLe: new Date() },
    });
    await this.audit.log({
      actorId: demandeurId,
      action: AuditAction.MODIFICATION,
      entityType: type === TypeTravailCalcul.VERIFICATION ? 'VersionModele' : 'TravailCalcul',
      entityId: type === TypeTravailCalcul.VERIFICATION ? versionId : id,
      metadata: { event: type === TypeTravailCalcul.VERIFICATION ? 'verification_paquet_echec' : 'execution_echec', travailId: id, message: message.slice(0, 300) },
    });
  }

  private async finirVerification(id: string, demandeurId: string, versionId: string, fiche: FicheModele, r: Record<string, unknown>, dureeMs: number): Promise<void> {
    if (r.statut !== 'ok') {
      await this.echec(id, demandeurId, versionId, TypeTravailCalcul.VERIFICATION, String(r.message ?? 'Vérification impossible.'));
      return;
    }
    const lus = Array.isArray(r.controles) ? (r.controles as Record<string, unknown>[]) : [];
    const declares = new Map((fiche.controles ?? []).map((c) => [c.id, c]));
    const controles: ControleVersion[] = lus.map((c) => {
      const d = declares.get(String(c.id));
      return {
        id: String(c.id),
        libelle: d?.libelle ?? String(c.id),
        type: c.type === 'alerte' || (c.type === undefined && d?.type === 'alerte') ? 'alerte' : 'bloquant',
        ok: c.ok === true,
        valeur: typeof c.valeur === 'string' ? c.valeur : JSON.stringify(c.valeur ?? null),
        seuil: d?.seuil ?? null,
      };
    });
    const info = (r.info ?? {}) as Record<string, unknown>;
    if (info.code !== fiche.code) {
      await this.echec(id, demandeurId, versionId, TypeTravailCalcul.VERIFICATION, 'Le code du modèle lu par le service de calcul diffère de celui de modele.json.');
      return;
    }
    if (!controles.length) {
      await this.echec(id, demandeurId, versionId, TypeTravailCalcul.VERIFICATION, 'Le paquet n’a renvoyé aucun contrôle de dépôt.');
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.versionModele.update({ where: { id: versionId }, data: { statut: StatutVersionModele.CONTROLEE, controles: controles as unknown as Prisma.InputJsonValue, controleLe: new Date() } });
      await tx.travailCalcul.update({ where: { id }, data: { statut: StatutTravailCalcul.TERMINE, etape: null, message: null, termineLe: new Date(), dureeMs } });
      await this.audit.log(
        {
          actorId: demandeurId,
          action: AuditAction.MODIFICATION,
          entityType: 'VersionModele',
          entityId: versionId,
          metadata: {
            event: 'controles_depot',
            reussis: controles.filter((c) => c.ok).length,
            echecsBloquants: controles.filter((c) => !c.ok && c.type === 'bloquant').map((c) => c.id),
            alertes: controles.filter((c) => !c.ok && c.type === 'alerte').map((c) => c.id),
            dureeMs,
          },
        },
        tx,
      );
    });
  }

  private async finirExecution(id: string, r: Record<string, unknown>, dureeMs: number): Promise<void> {
    if (r.statut !== 'ok') {
      const t = await this.prisma.travailCalcul.findUniqueOrThrow({ where: { id }, select: { demandeurId: true, versionId: true } });
      await this.echec(id, t.demandeurId, t.versionId, TypeTravailCalcul.EXECUTION, String(r.message ?? 'Le calcul a échoué.'));
      return;
    }
    const resultat = (r.resultat ?? {}) as Record<string, unknown>;
    await this.prisma.travailCalcul.update({
      where: { id },
      data: { statut: StatutTravailCalcul.TERMINE, etape: null, message: null, resultat: resultat as Prisma.InputJsonValue, termineLe: new Date(), dureeMs },
    });
  }
}
