import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Le service de calcul ne répond pas (endormi qui ne se réveille pas, arrêté, occupé) : le travail sera relancé. */
export class CalculInjoignable extends Error {}
/** Le service de calcul refuse la demande (secret, paquet refusé…) : relancer ne servirait à rien. */
export class CalculRefuse extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export const CLE_DERNIER_CONTACT = 'calcul.dernierContact';
export type DernierContact = { date: string; operation: string; succes: boolean; dureeMs: number; message: string | null };

/** Délais d'attente côté API : réveil du service gratuit (~1 min), vérification 300 s, exécution 600 s (+ marge). */
const DELAI_SANTE_MS = 90_000;
const DELAI_VERIFICATION_MS = 330_000;
const DELAI_EXECUTION_MS = 630_000;

/**
 * Client du service de calcul « dnpec-calcul » (CALCUL_URL, secret partagé CALCUL_SECRET).
 * Chaque appel est noté (date, opération, succès, durée) pour la supervision, sans aucun chiffre.
 */
@Injectable()
export class CalculClient {
  constructor(private readonly prisma: PrismaService) {}

  get configure(): boolean {
    return !!process.env.CALCUL_URL && (process.env.CALCUL_SECRET ?? '').length >= 16;
  }

  private url(chemin: string): string {
    return `${(process.env.CALCUL_URL ?? '').replace(/\/+$/, '')}${chemin}`;
  }

  private async noter(operation: string, t0: number, succes: boolean, message: string | null): Promise<void> {
    const valeur: DernierContact = { date: new Date().toISOString(), operation, succes, dureeMs: Date.now() - t0, message };
    await this.prisma.parametre
      .upsert({ where: { cle: CLE_DERNIER_CONTACT }, create: { cle: CLE_DERNIER_CONTACT, valeur }, update: { valeur } })
      .catch(() => undefined);
  }

  private async appeler(operation: string, chemin: string, init: RequestInit, delaiMs: number): Promise<{ status: number; corps: Record<string, unknown> }> {
    if (!this.configure) throw new CalculInjoignable('Service de calcul non configuré (CALCUL_URL, CALCUL_SECRET).');
    const t0 = Date.now();
    let r: Response;
    try {
      r = await fetch(this.url(chemin), { ...init, signal: AbortSignal.timeout(delaiMs), headers: { ...(init.headers ?? {}), 'X-Calcul-Secret': process.env.CALCUL_SECRET ?? '' } });
    } catch (e) {
      const message = e instanceof Error && e.name === 'TimeoutError' ? 'Le service de calcul n’a pas répondu à temps.' : 'Service de calcul injoignable.';
      await this.noter(operation, t0, false, message);
      throw new CalculInjoignable(message);
    }
    const texte = await r.text().catch(() => '');
    let corps: Record<string, unknown> = {};
    try {
      corps = JSON.parse(texte);
    } catch {
      corps = {};
    }
    // 502/503/504 : service en train de se réveiller, occupé ou arrêté chez l'hébergeur.
    if ([502, 503, 504].includes(r.status) || (r.status >= 500 && !corps.code)) {
      const message = typeof corps.message === 'string' ? corps.message : `Service de calcul indisponible (HTTP ${r.status}).`;
      await this.noter(operation, t0, false, message);
      throw new CalculInjoignable(message);
    }
    await this.noter(operation, t0, r.status < 400 || r.status === 409, r.status < 400 ? null : String(corps.message ?? `HTTP ${r.status}`));
    return { status: r.status, corps };
  }

  /** Sonde : réveille le service s'il dort (Render le démarre au premier appel). */
  async sante(): Promise<void> {
    const { status } = await this.appeler('sante', '/sante', { method: 'GET' }, DELAI_SANTE_MS);
    if (status !== 200) throw new CalculInjoignable(`Service de calcul indisponible (HTTP ${status}).`);
  }

  async verifier(zip: Buffer, empreinte: string): Promise<Record<string, unknown>> {
    const fd = new FormData();
    fd.append('empreinte', empreinte);
    fd.append('paquet', new Blob([zip], { type: 'application/zip' }), 'paquet.zip');
    const { status, corps } = await this.appeler('verification', '/paquets/verifier', { method: 'POST', body: fd }, DELAI_VERIFICATION_MS);
    if (status !== 200) throw new CalculRefuse(String(corps.message ?? `Refus du service de calcul (HTTP ${status}).`), String(corps.code ?? 'REFUS'));
    return corps;
  }

  /** Exécution : l'empreinte seule d'abord ; le zip est renvoyé si le service ne l'a plus (409 « paquet inconnu »). */
  async executer(empreinte: string, scenario: unknown, lireZip: () => Promise<Buffer>): Promise<Record<string, unknown>> {
    const envoi = async (zip?: Buffer) => {
      const fd = new FormData();
      fd.append('empreinte', empreinte);
      fd.append('scenario', JSON.stringify(scenario));
      if (zip) fd.append('paquet', new Blob([zip], { type: 'application/zip' }), 'paquet.zip');
      return this.appeler('execution', '/executer', { method: 'POST', body: fd }, DELAI_EXECUTION_MS);
    };
    let r = await envoi();
    if (r.status === 409 && r.corps.code === 'PAQUET_INCONNU') r = await envoi(await lireZip());
    if (r.status !== 200) throw new CalculRefuse(String(r.corps.message ?? `Refus du service de calcul (HTTP ${r.status}).`), String(r.corps.code ?? 'REFUS'));
    return r.corps;
  }
}
